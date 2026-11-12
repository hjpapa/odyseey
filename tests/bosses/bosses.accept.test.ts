// [수용 테스트 — Codex 보스 패턴] npm run test:accept -- tests/bosses
import { describe, expect, it } from 'vitest';
import { hasDedicatedBoss } from '../../src/enemies/bosses';
import { BOSS_IDS, type BossId } from '../../src/types/contracts';

const LAND_BOSSES = BOSS_IDS.filter((id) => id !== 'scylla') as BossId[];

describe('보스 패턴', () => {
  it('땅 위 보스 8종 모두 전용 패턴이 있다 (기본 대역이 아님)', () => {
    expect(LAND_BOSSES.filter((id) => !hasDedicatedBoss(id))).toEqual([]);
  });
});
