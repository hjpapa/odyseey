// [수용 테스트 — Codex 미니게임] npm run test:accept -- tests/minigames
import { describe, expect, it } from 'vitest';
import { ISLAND_MINIGAMES } from '../../src/story/minigames';
import { chapters } from '../../src/content';
import { CHAPTER_IDS, type MinigameId } from '../../src/types/contracts';

/** 챕터 데이터가 실제로 쓰는 섬 미니게임 (waveRunner 는 바다 코스 엔진이 직접 다룸) */
const USED = [...new Set(
  CHAPTER_IDS.flatMap((id) => chapters[id]?.objectives ?? [])
    .filter((o) => o.type === 'minigame' && o.target && o.target !== 'waveRunner')
    .map((o) => o.target as MinigameId),
)];

describe('섬 미니게임', () => {
  it('챕터에서 쓰는 미니게임이 모두 구현되어 있다 (준비 중 안내로 넘어가지 않음)', () => {
    expect(USED.length).toBeGreaterThan(0);
    expect(USED.filter((id) => typeof ISLAND_MINIGAMES[id] !== 'function')).toEqual([]);
  });
});
