/**
 * [임시 구현 — Codex A2 가 교체]
 * 지금은 학년과 상관없이 10 이내 덧셈·뺄셈만 냅니다. 계약: MathGenerator (src/types/contracts.ts)
 */
import type { ChoiceQuestion, MathGenerator, NumberQuestion } from '../../types/contracts';
import { createRng } from '../../core/rng';

export const generateMath: MathGenerator = ({ grade, seed, format = 'choice' }) => {
  const rng = createRng(seed);
  const isAdd = rng.chance(0.5);
  let a = rng.int(1, 9);
  let b = rng.int(1, 9);
  if (isAdd) {
    b = rng.int(0, 10 - a);
  } else if (b > a) {
    [a, b] = [b, a];
  }
  const answer = isAdd ? a + b : a - b;
  const sign = isAdd ? '+' : '-';
  const base = {
    id: `math:${isAdd ? 'add' : 'sub'}:${a}${sign}${b}`,
    subject: 'math' as const,
    grade,
    prompt: `${a} ${sign} ${b} = ?`,
  };
  if (format === 'number') {
    const q: NumberQuestion = { ...base, kind: 'number', answer };
    return q;
  }
  const wrong = new Set<number>();
  for (const d of rng.shuffle([1, -1, 2, -2, 3])) {
    if (answer + d >= 0) wrong.add(answer + d);
    if (wrong.size === 3) break;
  }
  const choices = rng.shuffle([answer, ...wrong]);
  const q: ChoiceQuestion = {
    ...base,
    kind: 'choice',
    choices: choices.map(String),
    answerIndex: choices.indexOf(answer),
  };
  return q;
};
