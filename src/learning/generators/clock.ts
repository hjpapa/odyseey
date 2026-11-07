/**
 * [임시 구현 — Codex A2 가 교체]
 * 지금은 '정각 읽기'만 냅니다. clockHandAngles 는 완성본입니다.
 * 계약: ClockGenerator, ClockHandAngles (src/types/contracts.ts)
 */
import type { ChoiceQuestion, ClockGenerator, ClockHandAngles } from '../../types/contracts';
import { createRng } from '../../core/rng';

export const clockHandAngles: ClockHandAngles = ({ h, m }) => ({
  hourDeg: ((h % 12) * 30 + m * 0.5) % 360,
  minuteDeg: (m * 6) % 360,
});

export const generateClock: ClockGenerator = ({ grade, seed }) => {
  const rng = createRng(seed);
  const h = rng.int(1, 12);
  const wrong = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((x) => x !== h)).slice(0, 3);
  const opts = rng.shuffle([h, ...wrong]);
  const q: ChoiceQuestion = {
    id: `clock:read:${h}:00`,
    subject: 'clock',
    grade,
    kind: 'choice',
    prompt: '시계가 가리키는 시각은?',
    clock: { h, m: 0 },
    choices: opts.map((x) => `${x}시`),
    answerIndex: opts.indexOf(h),
  };
  return q;
};
