// 문제 생성기 안전 규칙 (항상 통과해야 함). 학년별 출제 범위 완성도는 generators.accept.test.ts 에서.
import { describe, expect, it } from 'vitest';
import { clockHandAngles, generateClock, generateMath } from '../../src/learning/generators';
import type { Grade, Question } from '../../src/types/contracts';
import { parseMathId, validateQuestion } from '../helpers/validate';

const GRADES: Grade[] = [1, 2, 3];
const MAX_BY_GRADE: Record<Grade, number> = { 1: 20, 2: 200, 3: 1998 };
const SNAP_BY_GRADE: Record<Grade, number> = { 1: 30, 2: 5, 3: 1 };

function numbersIn(q: Question): number[] {
  const out: number[] = [];
  const parsed = parseMathId(q.id);
  if (parsed) out.push(parsed.a, parsed.b);
  if (q.kind === 'number') out.push(q.answer);
  if (q.kind === 'choice') q.choices.forEach((c) => /^\d+$/.test(c) && out.push(Number(c)));
  return out;
}

describe('수학 생성기 — 안전 규칙', () => {
  for (const grade of GRADES) {
    it(`${grade}학년: 형식이 맞고, 수 범위(≤${MAX_BY_GRADE[grade]})를 넘지 않고, 음수가 없다`, () => {
      for (let seed = 0; seed < 400; seed++) {
        for (const format of ['choice', 'number'] as const) {
          const q = generateMath({ grade, seed, format });
          expect(validateQuestion(q)).toEqual([]);
          expect(q.subject).toBe('math');
          expect(q.kind).toBe(format);
          expect(parseMathId(q.id), `id 형식 'math:<op>:<a><+|-|x|/><b>' (${q.id})`).not.toBeNull();
          for (const n of numbersIn(q)) {
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThanOrEqual(MAX_BY_GRADE[grade]);
          }
        }
      }
    });
  }

  it('같은 seed → 같은 문제', () => {
    for (const grade of GRADES) {
      expect(generateMath({ grade, seed: 123 })).toEqual(generateMath({ grade, seed: 123 }));
    }
  });
});

describe('시계 생성기 — 안전 규칙', () => {
  for (const grade of GRADES) {
    it(`${grade}학년: 형식과 분 단위(${SNAP_BY_GRADE[grade]}분) 규칙`, () => {
      for (let seed = 0; seed < 400; seed++) {
        const q = generateClock({ grade, seed });
        expect(validateQuestion(q)).toEqual([]);
        expect(q.subject).toBe('clock');
        expect(q.id).toMatch(/^clock:(read|set|elapsed):\d{1,2}:\d{2}/);
        const t = q.kind === 'clockSet' ? q.answer : q.clock;
        if (t && !q.id.startsWith('clock:elapsed')) expect(t.m % SNAP_BY_GRADE[grade]).toBe(0);
        if (q.kind === 'clockSet') expect(q.snapMinutes).toBe(SNAP_BY_GRADE[grade]);
      }
    });
  }

  it('clockHandAngles: 시침은 분에 따라 비례 이동', () => {
    expect(clockHandAngles({ h: 3, m: 0 })).toEqual({ hourDeg: 90, minuteDeg: 0 });
    expect(clockHandAngles({ h: 12, m: 30 })).toEqual({ hourDeg: 15, minuteDeg: 180 });
    expect(clockHandAngles({ h: 9, m: 45 })).toEqual({ hourDeg: 292.5, minuteDeg: 270 });
  });
});
