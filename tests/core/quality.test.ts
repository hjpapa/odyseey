import { describe, expect, it } from 'vitest';
import { TIERS, TOP_LEVEL, initialLevel } from '../../src/core/quality';
import { parsePrefs } from '../../src/game/prefs';

describe('화질 단계', () => {
  it('저장된 단계가 있으면 그대로 쓴다', () => {
    expect(initialLevel('0', { touch: false })).toBe(0);
    expect(initialLevel('1', { touch: false, cores: 16 })).toBe(1);
  });

  it('처음에는 기기에 맞춘다 — 터치 기기는 중간, 메모리·코어가 적으면 낮게', () => {
    expect(initialLevel(null, { touch: false, cores: 8, memoryGb: 8 })).toBe(TOP_LEVEL);
    expect(initialLevel(null, { touch: true, cores: 8, memoryGb: 4 })).toBe(1);
    expect(initialLevel(null, { touch: true, cores: 8, memoryGb: 2 })).toBe(0);
    expect(initialLevel(null, { touch: true, cores: 2 })).toBe(0);
  });

  it('이상한 저장값은 무시한다', () => {
    expect(initialLevel('9', { touch: false })).toBe(TOP_LEVEL);
    expect(initialLevel('x', { touch: true })).toBe(1);
    expect(initialLevel('', { touch: true })).toBe(1);
  });

  it('단계가 낮을수록 가볍다', () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i - 1].ratio).toBeLessThanOrEqual(TIERS[i].ratio);
      expect(TIERS[i - 1].shadowMap).toBeLessThan(TIERS[i].shadowMap);
      expect(TIERS[i - 1].waterSeg).toBeLessThan(TIERS[i].waterSeg);
    }
    expect(TIERS[0].shadowMap).toBe(0);
  });
});

describe('화면 설정', () => {
  it('저장값이 없으면 기기의 동작 줄이기 설정을 따른다', () => {
    expect(parsePrefs(null, true)).toEqual({ bigText: false, calm: true });
    expect(parsePrefs(null, false)).toEqual({ bigText: false, calm: false });
  });

  it('저장값을 읽고, 깨진 값은 기본값으로', () => {
    expect(parsePrefs('{"bigText":true,"calm":false}', true)).toEqual({ bigText: true, calm: false });
    expect(parsePrefs('{"bigText":"네"}', false)).toEqual({ bigText: false, calm: false });
    expect(parsePrefs('{깨짐', true)).toEqual({ bigText: false, calm: true });
  });
});
