// 섬 레이아웃 형식 검사 (있는 파일만). 14곳 완성·챕터 연결은 islands.accept.test.ts 에서.
import { describe, expect, it } from 'vitest';
import { chapters, islandEntries } from '../../src/content';
import { validateIsland } from '../helpers/validate';

describe('섬 레이아웃 형식', () => {
  it('data/islands/*.json 이 계약을 지킨다', () => {
    const errors = islandEntries.flatMap(([file, data]) => validateIsland(data, file));
    expect(errors).toEqual([]);
  });

  it('지혜의 문은 해당 장의 퀴즈 자리를 가리킨다 (그 장 데이터가 있을 때)', () => {
    const errors: string[] = [];
    for (const [, isl] of islandEntries) {
      for (const g of isl.gates) {
        const ch = chapters[g.chapter];
        if (ch && !ch.quizSlots.some((s) => s.id === g.quizSlot)) {
          errors.push(`island[${isl.id}] gate '${g.id}': ${g.chapter} 에 quizSlot '${g.quizSlot}' 없음`);
        }
      }
    }
    expect(errors).toEqual([]);
  });
});
