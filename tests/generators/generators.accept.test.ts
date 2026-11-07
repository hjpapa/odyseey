// [수용 테스트 — Codex A2] npm run test:accept -- tests/generators
import { describe, expect, it } from 'vitest';
import { generateClock, generateMath } from '../../src/learning/generators';
import type { Grade, MathOp, Question } from '../../src/types/contracts';
import { answerOf, parseMathId } from '../helpers/validate';

const N = 1000;
const many = (grade: Grade, extra: { ops?: MathOp[] } = {}) =>
  Array.from({ length: N }, (_, seed) => generateMath({ grade, seed, ...extra }));
const opsOf = (qs: Question[]) => new Set(qs.map((q) => parseMathId(q.id)!.op));

describe('A2 수학 — 학년별 출제 범위', () => {
  it('1학년: 덧셈·뺄셈만, 20 이내', () => {
    const qs = many(1);
    expect([...opsOf(qs)].sort()).toEqual(['add', 'sub']);
    for (const q of qs) expect(Number(answerOf(q))).toBeLessThanOrEqual(20);
  });

  it('2학년: 받아올림 있는 두 자리 덧셈과 곱셈구구(2~5단)가 나온다', () => {
    const qs = many(2);
    expect(opsOf(qs)).toEqual(new Set(['add', 'sub', 'mul']));
    const carry = qs.map((q) => parseMathId(q.id)!).filter((p) => p.op === 'add' && p.a >= 10 && p.b >= 10 && (p.a % 10) + (p.b % 10) >= 10);
    expect(carry.length).toBeGreaterThan(20);
    for (const p of qs.map((q) => parseMathId(q.id)!).filter((p) => p.op === 'mul')) {
      expect([2, 3, 4, 5].includes(p.a) || [2, 3, 4, 5].includes(p.b), `${p.a}x${p.b}`).toBe(true);
      expect(Math.max(p.a, p.b)).toBeLessThanOrEqual(9);
    }
  });

  it('3학년: 세 자리 수, 곱셈구구 전체, 나머지 없는 나눗셈', () => {
    const qs = many(3);
    expect(opsOf(qs)).toEqual(new Set(['add', 'sub', 'mul', 'div']));
    const parsed = qs.map((q) => parseMathId(q.id)!);
    expect(parsed.some((p) => (p.op === 'add' || p.op === 'sub') && p.a >= 100)).toBe(true);
    expect(parsed.some((p) => p.op === 'mul' && (p.a >= 6 || p.b >= 6))).toBe(true);
    for (const p of parsed.filter((p) => p.op === 'div')) expect(p.a % p.b, `${p.a}/${p.b}`).toBe(0);
  });

  it('정답이 실제로 맞다', () => {
    for (const grade of [1, 2, 3] as Grade[]) {
      for (const q of many(grade)) {
        const p = parseMathId(q.id)!;
        const expected = { add: p.a + p.b, sub: p.a - p.b, mul: p.a * p.b, div: p.a / p.b }[p.op as MathOp];
        expect(Number(answerOf(q)), q.id).toBe(expected);
      }
    }
  });

  it('보기는 4개, 그럴듯한 오답(정답과 10 이내 차이가 2개 이상)', () => {
    for (const grade of [1, 2, 3] as Grade[]) {
      for (const q of many(grade)) {
        if (q.kind !== 'choice') continue;
        expect(q.choices.length).toBe(4);
        const ans = Number(answerOf(q));
        const near = q.choices.map(Number).filter((c) => c !== ans && Math.abs(c - ans) <= 10);
        expect(near.length, `${q.id} ${JSON.stringify(q.choices)}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('문장형 템플릿: {a},{b} 가 채워지고 연산이 지켜진다', () => {
    for (const grade of [1, 2, 3] as Grade[]) {
      for (let seed = 0; seed < 200; seed++) {
        const q = generateMath({ grade, seed, template: { op: 'sub', text: '양 {a}마리 중 {b}마리가 나갔어요. 남은 양은?', emoji: '🐑' } });
        const p = parseMathId(q.id)!;
        expect(p.op).toBe('sub');
        expect(q.prompt).toBe(`양 ${p.a}마리 중 ${p.b}마리가 나갔어요. 남은 양은?`);
        expect(q.emoji).toBe('🐑');
      }
    }
  });

  it('학년에 없는 연산 템플릿도 쉬운 수로 낸다 (1학년 곱셈 → 묶어 세기, 답 20 이내)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const q = generateMath({ grade: 1, seed, template: { op: 'mul', text: '배 {a}척에 {b}명씩 타면 모두 몇 명?' } });
      expect(Number(answerOf(q))).toBeLessThanOrEqual(20);
    }
  });
});

describe('A2 시계 — 학년별 출제 범위', () => {
  const clocks = (grade: Grade, type?: 'read' | 'set' | 'elapsed') =>
    Array.from({ length: N }, (_, seed) => generateClock({ grade, seed, type }));

  it('read 문제에는 시계 그림 시각(clock)이 있다', () => {
    for (const grade of [1, 2, 3] as Grade[]) for (const q of clocks(grade, 'read')) expect(q.clock, q.id).toBeDefined();
  });

  it('1학년 정각·30분 / 2학년 5분 단위(정각·30분 아닌 것 포함) / 3학년 1분 단위(5분 배수 아닌 것 포함)', () => {
    const minutes = (g: Grade) => clocks(g, 'read').map((q) => q.clock!.m);
    expect(new Set(minutes(1))).toEqual(new Set([0, 30]));
    expect(minutes(2).every((m) => m % 5 === 0)).toBe(true);
    expect(minutes(2).some((m) => m !== 0 && m !== 30)).toBe(true);
    expect(minutes(3).some((m) => m % 5 !== 0)).toBe(true);
  });

  it('set 문제는 clockSet 이고 학년별 snapMinutes', () => {
    const snap = { 1: 30, 2: 5, 3: 1 } as const;
    for (const grade of [1, 2, 3] as Grade[]) {
      for (const q of clocks(grade, 'set')) {
        expect(q.kind).toBe('clockSet');
        if (q.kind === 'clockSet') expect(q.snapMinutes).toBe(snap[grade]);
      }
    }
  });

  it('elapsed(걸린 시간) 문제가 2·3학년에 나온다', () => {
    for (const grade of [2, 3] as Grade[]) {
      const qs = clocks(grade, 'elapsed');
      for (const q of qs) {
        expect(q.id.startsWith('clock:elapsed')).toBe(true);
        expect(q.kind).toBe('choice');
      }
    }
  });

  it('type 을 안 주면 학년에 맞게 섞인다 (2·3학년은 read·set·elapsed 모두)', () => {
    for (const grade of [2, 3] as Grade[]) {
      const types = new Set(clocks(grade).map((q) => q.id.split(':')[1]));
      expect(types).toEqual(new Set(['read', 'set', 'elapsed']));
    }
  });
});
