import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeaStage } from '../../src/game/seaStage';

interface SeaAsyncPaths {
  countdown(): Promise<void>;
  finishRun(): Promise<void>;
  broken(): Promise<void>;
}

/** Exercise the real async transition methods without constructing a WebGL scene. */
function seaFixture() {
  const life = new AbortController();
  const hud = { toast: vi.fn(), setHearts: vi.fn(), setExtra: vi.fn(), setBoss: vi.fn() };
  const fade = vi.fn().mockResolvedValue(undefined);
  const stage = Object.assign(Object.create(SeaStage.prototype) as SeaAsyncPaths, {
    signal: life.signal,
    chapter: { bgm: { explore: 'sailing' } },
    mode: 'runner',
    layout: { zones: [] as { id: string }[] },
    runner: { emit: vi.fn(), idle: vi.fn().mockResolvedValue(undefined) },
    svc: {
      audio: { sfx: vi.fn(), playBgm: vi.fn() },
      ui: { hud, screens: { fade } },
    },
    z: 892,
    running: false,
    started: false,
    finishing: false,
    scarfUsed: true,
    lastCheckpoint: 0,
    fails: 0,
    boss: null,
    halted: false,
    hp: 0,
    invuln: 0,
    clearAhead: vi.fn(),
    showStartHint: vi.fn(),
  });
  return { stage, life, hud, fade };
}

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }));
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('바다 장면을 떠난 뒤 비동기 작업 정리', () => {
  it('정상 카운트다운은 출발 안내까지 이어진다', async () => {
    const { stage, hud } = seaFixture();
    const pending = stage.countdown();
    await vi.advanceTimersByTimeAsync(2700);
    await pending;
    expect(hud.toast.mock.calls.map(([text]) => text)).toEqual(['3', '2', '1', '출발! ⛵']);
    expect(stage.running).toBe(true);
    expect(stage.showStartHint).toHaveBeenCalledOnce();
  });

  it('카운트다운 중 떠나면 남은 알림이나 출발이 실행되지 않는다', async () => {
    const { stage, life, hud } = seaFixture();
    const pending = stage.countdown();
    life.abort();
    await vi.advanceTimersByTimeAsync(3000);
    await pending;
    expect(hud.toast).toHaveBeenCalledOnce();
    expect(stage.svc.audio.sfx).toHaveBeenCalledOnce();
    expect(stage.running).toBe(false);
    expect(stage.showStartHint).not.toHaveBeenCalled();
  });

  it('정상 도착은 waveRunner 완료를 한 번 전달한다', async () => {
    const { stage, hud } = seaFixture();
    const pending = stage.finishRun();
    await vi.advanceTimersByTimeAsync(1600);
    await pending;
    expect(hud.setExtra).toHaveBeenCalledWith(null);
    expect(stage.runner.emit).toHaveBeenCalledExactlyOnceWith({ type: 'minigame', id: 'waveRunner' });
  });

  it.each([200, 1490])('도착 애니메이션 %dms 지점에서 떠나면 예전 완료 사건을 내보내지 않는다', async (ms) => {
    const { stage, life, hud } = seaFixture();
    const pending = stage.finishRun();
    await vi.advanceTimersByTimeAsync(ms);
    life.abort();
    await vi.advanceTimersByTimeAsync(1600);
    await pending;
    expect(stage.runner.emit).not.toHaveBeenCalled();
    expect(hud.setExtra).not.toHaveBeenCalled();
  });

  it('스카프 대화를 기다리다 떠나면 복구 알림과 하트를 되살리지 않는다', async () => {
    const { stage, life, hud } = seaFixture();
    stage.scarfUsed = false;
    stage.layout.zones = [{ id: 'ino-scarf' }];
    let finishDialogue!: () => void;
    stage.runner.idle.mockImplementation(() => new Promise<void>((resolve) => { finishDialogue = resolve; }));
    const pending = stage.broken();
    life.abort();
    finishDialogue();
    await pending;
    expect(hud.toast).not.toHaveBeenCalled();
    expect(hud.setHearts).not.toHaveBeenCalled();
    expect(stage.running).toBe(false);
  });

  it('복구 화면이 어두워지는 중 떠나면 새 장면에 두 번째 전환을 실행하지 않는다', async () => {
    const { stage, life, hud, fade } = seaFixture();
    let finishFade!: () => void;
    fade.mockImplementationOnce(() => new Promise<void>((resolve) => { finishFade = resolve; }));
    const pending = stage.broken();
    life.abort();
    finishFade();
    await pending;
    expect(fade).toHaveBeenCalledExactlyOnceWith(true, 350);
    expect(stage.fails).toBe(0);
    expect(hud.setHearts).not.toHaveBeenCalled();
    expect(stage.running).toBe(false);
  });

  it('복구 화면이 밝아지는 중 떠나면 복구 안내를 남기지 않는다', async () => {
    const { stage, life, hud, fade } = seaFixture();
    let finishFade!: () => void;
    fade.mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFade = resolve; }));
    const pending = stage.broken();
    await Promise.resolve();
    expect(fade).toHaveBeenCalledTimes(2);
    life.abort();
    finishFade();
    await pending;
    expect(hud.toast).not.toHaveBeenCalled();
    expect(hud.setHearts).not.toHaveBeenCalled();
    expect(stage.running).toBe(false);
  });

  it('복구 뒤 대기 중 떠나도 예전 배가 다시 달리지 않는다', async () => {
    const { stage, life, hud } = seaFixture();
    const pending = stage.broken();
    await vi.advanceTimersByTimeAsync(0);
    expect(hud.setHearts).toHaveBeenCalledOnce();
    life.abort();
    await vi.advanceTimersByTimeAsync(600);
    await pending;
    expect(stage.running).toBe(false);
    expect(hud.setHearts).toHaveBeenCalledOnce();
  });

  it('이미 떠난 장면에서는 카운트다운·도착·복구를 시작하지 않는다', async () => {
    const { stage, life, hud, fade } = seaFixture();
    life.abort();
    await stage.countdown();
    await stage.finishRun();
    await stage.broken();
    expect(hud.toast).not.toHaveBeenCalled();
    expect(stage.svc.audio.sfx).not.toHaveBeenCalled();
    expect(stage.runner.emit).not.toHaveBeenCalled();
    expect(fade).not.toHaveBeenCalled();
  });
});
