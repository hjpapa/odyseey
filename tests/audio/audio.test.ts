// 사운드 형식 검사 (항상 통과해야 함). 전곡·전효과음 완성은 audio.accept.test.ts 에서.
import { describe, expect, it } from 'vitest';
import { createAudio } from '../../src/audio';
import { sfxPresets } from '../../src/audio/sfx';
import { bgmTracks } from '../../src/audio/tracks';
import { SFX_IDS, type BgmTrack } from '../../src/types/contracts';
import { has, validateTrack } from '../helpers/validate';

describe('오디오 API', () => {
  it('브라우저 밖(node)에서 만들고 호출해도 오류가 없다 — 첫 입력 전 AudioContext 생성 금지', () => {
    const audio = createAudio();
    expect(audio.unlocked).toBe(false);
    expect(() => {
      audio.sfx('coin');
      audio.playBgm('title');
      audio.stopBgm();
      audio.setVolume('master', 0.5);
    }).not.toThrow();
  });
});

describe('효과음 프리셋 형식', () => {
  it('키는 SFX_IDS, 값은 ZzFX 숫자 배열', () => {
    for (const [id, params] of Object.entries(sfxPresets)) {
      expect(has(SFX_IDS, id), `알 수 없는 효과음 '${id}'`).toBe(true);
      expect(Array.isArray(params)).toBe(true);
      expect(params!.length).toBeLessThanOrEqual(21);
      for (const p of params!) expect(p === undefined || typeof p === 'number').toBe(true);
    }
  });
});

describe('배경음 곡 형식', () => {
  it('모든 곡 데이터가 올바르다', () => {
    const errors = Object.entries(bgmTracks).flatMap(([k, t]) => validateTrack(t as BgmTrack, k));
    expect(errors).toEqual([]);
  });
});
