import { describe, expect, it } from 'vitest';
import { generateClock, generateMath } from '../../src/learning/generators';
import type { Grade, MathOp } from '../../src/types/contracts';
import { answerOf, validateQuestion } from '../helpers/validate';

describe('학습 생성기 경계와 복습 키', () => {
  it('모든 명시 연산과 숫자형/선택형은 같은 수와 답을 쓴다', () => {
    for (const grade of [1, 2, 3] as Grade[]) for (const op of ['add', 'sub', 'mul', 'div'] as MathOp[]) {
      for (let seed = 0; seed < 120; seed++) {
        const args = { grade, seed, ops: [op] };
        const choice = generateMath(args), number = generateMath({ ...args, format: 'number' });
        expect(choice.id).toBe(number.id);
        expect(answerOf(choice)).toBe(answerOf(number));
        expect(validateQuestion(choice)).toEqual([]);
        if (choice.kind === 'choice') expect(choice.choices.every(c => Number(c) >= 0 && Number(c) <= { 1: 20, 2: 200, 3: 1998 }[grade])).toBe(true);
      }
    }
    expect(() => generateMath({ grade: 1, seed: 0, ops: [] })).not.toThrow();
  });

  it('걸린 시간의 정답은 12시를 넘어도 정확하며 보기는 중복이 없다', () => {
    let rollover = 0;
    for (const grade of [2, 3] as Grade[]) for (let seed = 0; seed < 500; seed++) {
      const q = generateClock({ grade, seed, type: 'elapsed' });
      const m = /:(\d+):(\d+)\+(\d+)$/.exec(q.id)!;
      const start = (Number(m[1]) % 12) * 60 + Number(m[2]), delta = Number(m[3]);
      if (start + delta >= 720) rollover++;
      const total = (start + delta) % 720, hour = Math.floor(total / 60) || 12, minute = total % 60;
      expect(answerOf(q)).toBe(minute ? `${hour}시 ${minute}분` : `${hour}시`);
      expect(validateQuestion(q)).toEqual([]);
      if (q.kind === 'choice') expect(q.choices).toHaveLength(4);
    }
    expect(rollover).toBeGreaterThan(30);
  });

  it('시침과 분침을 바꿔 읽은 오답이 들어 있고 결과가 결정적이다', () => {
    for (let seed = 0; seed < 100; seed++) {
      const q = generateClock({ grade: 3, seed, type: 'read' });
      expect(q).toEqual(generateClock({ grade: 3, seed, type: 'read' }));
      const { h, m } = q.clock!;
      const sh = Math.floor(m / 5) || 12, sm = (h % 12) * 5;
      if (q.kind === 'choice') expect(q.choices).toContain(sm ? `${sh}시 ${sm}분` : `${sh}시`);
    }
    expect(generateClock({ grade: 1, seed: 5, type: 'elapsed' }).id).toMatch(/^clock:read:/);
  });
});
