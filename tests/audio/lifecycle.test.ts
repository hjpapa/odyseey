import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  imports: 0, gains: [] as { value: number; setTargetAtTime: ReturnType<typeof vi.fn> }[],
  starts: [] as string[], stops: [] as number[], pauses: 0, soundStarts: 0,
}));
vi.mock('zzfx', () => {
  state.imports++;
  const context = {
    currentTime: 0, state: 'running', destination: {}, resume: vi.fn().mockResolvedValue(undefined),
    createGain() {
      const gain = { value: 0, setTargetAtTime: vi.fn() }; state.gains.push(gain);
      const node = { gain, connect: () => node, disconnect: vi.fn() }; return node;
    },
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createBufferSource() {
      const node = { buffer: null, playbackRate: { value: 1 }, onended: null,
        connect: () => node, disconnect: vi.fn(), start: () => state.soundStarts++ };
      return node;
    },
  };
  return { ZZFX: { audioContext: context, sampleRate: 44100, buildSamples: () => [0, .1, 0] } };
});
vi.mock('../../src/audio/sequencer', () => ({
  TrackPlayer: class {
    constructor(_ctx: unknown, private track: { id: string }) {}
    start() { state.starts.push(this.track.id); }
    stop(seconds: number) { state.stops.push(seconds); }
    pause() { state.pauses++; }
  },
}));

beforeEach(() => {
  vi.resetModules();
  state.imports = 0; state.gains.length = 0; state.starts.length = 0; state.stops.length = 0;
  state.pauses = 0; state.soundStarts = 0;
  vi.stubGlobal('window', {});
  vi.stubGlobal('AudioContext', class {});
  const doc = new EventTarget();
  Object.defineProperty(doc, 'hidden', { value: false, configurable: true });
  vi.stubGlobal('document', doc);
});
afterEach(() => vi.unstubAllGlobals());

describe('오디오 사용자 입력과 비동기 준비', () => {
  it('unlock 전에는 ZzFX 모듈도 컨텍스트도 만들지 않는다', async () => {
    const { createAudio } = await import('../../src/audio');
    const audio = createAudio();
    audio.sfx('coin'); audio.playBgm('title'); audio.setVolume('master', .25);
    expect(state.imports).toBe(0);
    expect(audio.unlocked).toBe(false);
    audio.unlock(); audio.unlock(); audio.sfx('correct');
    await vi.dynamicImportSettled();
    expect(state.imports).toBe(1);
    expect(audio.unlocked).toBe(true);
    expect(state.gains[0].value).toBe(.25);
    expect(state.starts).toEqual(['title']);
    expect(state.soundStarts).toBe(1);
    audio.stopBgm();
  });
  it('준비 중 마지막 곡 요청을 쓰고 같은 곡은 겹쳐 재생하지 않는다', async () => {
    const { createAudio } = await import('../../src/audio');
    const audio = createAudio();
    audio.playBgm('title'); audio.unlock(); audio.playBgm('island');
    await vi.dynamicImportSettled();
    audio.playBgm('island');
    expect(state.starts).toEqual(['island']);
    audio.playBgm('sailing', { fadeMs: 800 });
    expect(state.starts).toEqual(['island', 'sailing']);
    expect(state.stops).toEqual([.8]);
    audio.setVolume('bgm', 9);
    expect(state.gains[2].setTargetAtTime).toHaveBeenLastCalledWith(1, 0, .015);
    audio.stopBgm();
  });
  it('준비 중 취소한 곡은 뒤늦게 시작하지 않는다', async () => {
    const { createAudio } = await import('../../src/audio');
    const audio = createAudio();
    audio.playBgm('title'); audio.unlock(); audio.stopBgm();
    await vi.dynamicImportSettled();
    expect(state.starts).toEqual([]);
  });
  it('탭을 숨기면 멈추고 다시 보일 때 이어 재생한다', async () => {
    const { createAudio } = await import('../../src/audio');
    const audio = createAudio();
    audio.unlock(); audio.playBgm('title');
    await vi.dynamicImportSettled();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(state.pauses).toBe(1);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(state.starts).toEqual(['title', 'title']);
    audio.stopBgm();
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(state.starts).toHaveLength(2);
  });
  it('Node에서 unlock도 안전한 무동작이다', async () => {
    vi.stubGlobal('window', undefined);
    const { createAudio } = await import('../../src/audio');
    const audio = createAudio();
    expect(() => audio.unlock()).not.toThrow();
    expect(audio.unlocked).toBe(false);
    expect(state.imports).toBe(0);
  });
});
