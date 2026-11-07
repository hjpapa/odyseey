// [수용 테스트 — Codex A3] npm run test:accept -- tests/audio
import { describe, expect, it } from 'vitest';
import { sfxPresets } from '../../src/audio/sfx';
import { bgmTracks } from '../../src/audio/tracks';
import { BGM_IDS, SFX_IDS } from '../../src/types/contracts';
import { MODE_STEPS, pitchClass, trackSeconds } from '../helpers/validate';

describe('A3 효과음', () => {
  it('SFX_IDS 전부 프리셋이 있다', () => {
    expect(SFX_IDS.filter((id) => !sfxPresets[id])).toEqual([]);
  });
});

describe('A3 배경음', () => {
  it('BGM_IDS 전부 곡이 있다', () => {
    expect(BGM_IDS.filter((id) => !bgmTracks[id])).toEqual([]);
  });

  it('곡 길이(한 바퀴) 25~75초', () => {
    for (const id of BGM_IDS) {
      const t = bgmTracks[id];
      if (!t) continue;
      const sec = trackSeconds(t);
      expect(sec, `${id}: ${sec.toFixed(1)}초`).toBeGreaterThanOrEqual(25);
      expect(sec, `${id}: ${sec.toFixed(1)}초`).toBeLessThanOrEqual(75);
    }
  });

  it('선율 음의 85% 이상이 곡의 선법(root+mode) 안에 있다', () => {
    for (const id of BGM_IDS) {
      const t = bgmTracks[id];
      if (!t) continue;
      const root = pitchClass(t.root)!;
      const scale = new Set(MODE_STEPS[t.mode].map((s) => (root + s) % 12));
      const notes = t.patterns.flatMap((p) => p.layers.filter((l) => l.instrument !== 'drum').flatMap((l) => l.notes));
      const inScale = notes.filter((n) => scale.has(pitchClass(n.note)!)).length;
      expect(inScale / Math.max(1, notes.length), `${id} 선법 일치율`).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('곡마다 악기 2종 이상', () => {
    for (const id of BGM_IDS) {
      const t = bgmTracks[id];
      if (!t) continue;
      const inst = new Set(t.patterns.flatMap((p) => p.layers.map((l) => l.instrument)));
      expect(inst.size, id).toBeGreaterThanOrEqual(2);
    }
  });
});
