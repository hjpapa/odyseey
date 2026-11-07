import type { Rng } from '../../core/rng';

/** Keep likely mistakes close to the answer, unique and within the grade's range. */
export function numberChoices(answer: number, mistakes: number[], max: number, rng: Rng): number[] {
  const valid = (n: number) => Number.isInteger(n) && n >= 0 && n <= max && n !== answer;
  const near = [...new Set(rng.shuffle([answer - 1, answer + 1, answer - 2, answer + 2, answer - 10, answer + 10]))].filter(valid);
  const wrong = near.slice(0, 2);
  for (const n of [...rng.shuffle(mistakes), ...near]) {
    if (valid(n) && !wrong.includes(n)) wrong.push(n);
    if (wrong.length === 3) break;
  }
  return rng.shuffle([answer, ...wrong]);
}
