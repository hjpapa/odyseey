// [수용 테스트 — Codex B2] npm run test:accept -- tests/islands   (B1 챕터 데이터가 먼저 있어야 함)
import { describe, expect, it } from 'vitest';
import { chapters, islands } from '../../src/content';
import { CHAPTER_IDS, ISLAND_IDS, type IslandLayout } from '../../src/types/contracts';

const all = () => ISLAND_IDS.map((id) => islands[id]).filter((i): i is IslandLayout => !!i);

describe('B2 섬 레이아웃', () => {
  it('14곳 파일이 모두 있다', () => {
    expect(ISLAND_IDS.filter((id) => !islands[id])).toEqual([]);
  });

  it('기본 시설: 섬은 체크포인트 1·신전 1·보물상자 2 이상, 바다 코스는 체크포인트 2 이상', () => {
    for (const i of all()) {
      if (i.kind === 'island') {
        expect(i.checkpoints.length, `${i.id} checkpoints`).toBeGreaterThanOrEqual(1);
        expect(i.shrines.length, `${i.id} shrines`).toBeGreaterThanOrEqual(1);
        expect(i.chests.length, `${i.id} chests`).toBeGreaterThanOrEqual(2);
      } else if (i.kind === 'seaCourse') {
        expect(i.checkpoints.length, `${i.id} checkpoints`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('허브 맵에서 섬끼리 120m 이상 떨어져 있다 (실내 제외)', () => {
    const outdoor = all().filter((i) => i.kind !== 'interior');
    for (let a = 0; a < outdoor.length; a++) {
      for (let b = a + 1; b < outdoor.length; b++) {
        const d = Math.hypot(outdoor[a].hubPos[0] - outdoor[b].hubPos[0], outdoor[a].hubPos[1] - outdoor[b].hubPos[1]);
        expect(d, `${outdoor[a].id} ↔ ${outdoor[b].id}`).toBeGreaterThanOrEqual(120);
      }
    }
  });

  it('챕터 데이터와 연결된다 (문·보스·목표 대상)', () => {
    const errors: string[] = [];
    for (const id of CHAPTER_IDS) {
      const c = chapters[id];
      if (!c) continue;
      const isl = islands[c.island];
      if (!isl) {
        errors.push(`${id}: 섬 '${c.island}' 파일 없음`);
        continue;
      }
      if (!isl.chapters.includes(id)) errors.push(`${isl.id}: chapters 에 ${id} 없음`);
      for (const q of c.quizSlots.filter((s) => s.placement === 'gate')) {
        if (!isl.gates.some((g) => g.chapter === id && g.quizSlot === q.id)) errors.push(`${isl.id}: ${id} 퀴즈 자리 '${q.id}' 의 지혜의 문 없음`);
      }
      if (c.boss && isl.boss?.id !== c.boss) errors.push(`${isl.id}: boss 는 '${c.boss}' 여야 함`);
      for (const o of c.objectives) {
        const t = o.target ?? '';
        const need = o.count ?? 1;
        if (o.type === 'reach' && !isl.zones.some((z) => z.id === t)) errors.push(`${isl.id}: ${id} 목표 '${o.id}' 의 zone '${t}' 없음`);
        if (o.type === 'talk' && !isl.npcs.some((n) => n.id === t)) errors.push(`${isl.id}: ${id} 목표 '${o.id}' 의 npc '${t}' 없음`);
        if ((o.type === 'collect' || o.type === 'rescue') && isl.collectibles.filter((x) => x.item === t).length < need) {
          errors.push(`${isl.id}: ${id} 목표 '${o.id}' 에 필요한 '${t}' ${need}개가 collectibles 에 부족`);
        }
        if (o.type === 'defeat') {
          const total = isl.enemies.filter((e) => e.id === t).reduce((s, e) => s + e.count, 0);
          if (total < need) errors.push(`${isl.id}: ${id} 목표 '${o.id}' 에 필요한 적 '${t}' ${need}명 부족 (${total})`);
        }
      }
    }
    expect(errors).toEqual([]);
  });
});
