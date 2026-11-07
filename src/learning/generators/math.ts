import type { Grade, MathGenerator, MathOp } from '../../types/contracts';
import { createRng } from '../../core/rng';
import { numberChoices } from './choices';

const operations: Record<Grade, MathOp[]> = { 1: ['add', 'sub'], 2: ['add', 'sub', 'mul'], 3: ['add', 'sub', 'mul', 'div'] };
const symbols: Record<MathOp, string> = { add: '+', sub: '-', mul: 'x', div: '/' };
const hints: Record<MathOp, string> = {
  add: '10을 먼저 만들고 남은 수를 더해 볼까요?',
  sub: '일의 자리부터 빼고, 모자라면 십에서 빌려요.',
  mul: '같은 수를 묶음 수만큼 더해 볼까요?',
  div: '한 묶음씩 똑같이 나누어 볼까요?',
};

export const generateMath: MathGenerator = ({ grade, seed, ops, template, format = 'choice' }) => {
  const rng = createRng(seed);
  const op = template?.op ?? rng.pick(ops?.length ? ops : operations[grade]);
  let a: number, b: number;
  if (op === 'mul' || op === 'div') {
    // Explicit operations and story templates can ask for a later-grade concept.
    const group = rng.int(2, grade === 3 ? 9 : grade === 2 ? 5 : 4);
    const size = rng.int(1, grade === 1 ? 5 : 9);
    a = op === 'div' ? group * size : group;
    b = op === 'div' ? group : size;
  } else if (grade === 1) {
    a = rng.int(0, 20);
    b = rng.int(0, op === 'add' ? 20 - a : a);
  } else {
    const min = grade === 2 ? 10 : 100;
    const max = grade === 2 ? 99 : 999;
    a = rng.int(min, max);
    b = rng.int(min, max);
    if (op === 'sub' && b > a) [a, b] = [b, a];
  }
  const answer = { add: a + b, sub: a - b, mul: a * b, div: a / b }[op];
  const symbol = symbols[op];
  const base = {
    id: `math:${op}:${a}${symbol}${b}`,
    subject: 'math' as const,
    grade,
    prompt: template ? template.text.replaceAll('{a}', String(a)).replaceAll('{b}', String(b)) : `${a} ${op === 'mul' ? '×' : op === 'div' ? '÷' : symbol} ${b} = ?`,
    ...(template?.emoji ? { emoji: template.emoji } : {}),
    hint: grade === 1 && op === 'sub' ? '물건을 하나씩 빼며 남은 수를 세어 봐요.' : hints[op],
    explain: `${a} ${op === 'mul' ? '×' : op === 'div' ? '÷' : symbol} ${b} = ${answer}`,
  };
  if (format === 'number') return { ...base, kind: 'number', answer };
  const swapped = Number(String(answer).split('').reverse().join(''));
  const mistakes = [swapped, answer - 10, answer + 10,
    ...(op === 'mul' ? [answer - a, answer + a, a + b] : []),
    ...(op === 'sub' ? [Math.abs(Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs(a % 10 - b % 10)] : []),
  ];
  const choices = numberChoices(answer, mistakes, { 1: 20, 2: 200, 3: 1998 }[grade], rng);
  return { ...base, kind: 'choice', choices: choices.map(String), answerIndex: choices.indexOf(answer) };
};
