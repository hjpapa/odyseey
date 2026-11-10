import type { ClockGenerator, ClockHandAngles, ClockQuestionType, ClockTime } from '../../types/contracts';
import { createRng } from '../../core/rng';

export const clockHandAngles: ClockHandAngles = ({ h, m }) => ({
  hourDeg: ((h % 12) * 30 + m * 0.5) % 360,
  minuteDeg: (m * 6) % 360,
});

const fromMinutes = (minutes: number): ClockTime => {
  const total = ((minutes % 720) + 720) % 720;
  return { h: Math.floor(total / 60) || 12, m: total % 60 };
};
const label = ({ h, m }: ClockTime) => m === 0 ? `${h}시` : `${h}시 ${m}분`;

export const generateClock: ClockGenerator = ({ grade, seed, type }) => {
  const rng = createRng(seed);
  const snap = ({ 1: 30, 2: 5, 3: 1 } as const)[grade];
  const types: ClockQuestionType[] = grade === 1 ? ['read', 'set'] : ['read', 'set', 'elapsed'];
  const kind = type === 'elapsed' && grade === 1 ? 'read' : type ?? rng.pick(types);
  const clock = { h: rng.int(1, 12), m: rng.int(0, 60 / snap - 1) * snap };
  const id = `clock:${kind}:${clock.h}:${String(clock.m).padStart(2, '0')}`;
  const base = { id, subject: 'clock' as const, grade, emoji: '🕰️' };
  if (kind === 'set') return {
    ...base, kind: 'clockSet', prompt: `${label(clock)}에 맞춰 주세요.`, answer: clock, snapMinutes: snap,
    hint: '짧은 바늘은 시, 긴 바늘은 분을 나타내요.',
  };
  const start = (clock.h % 12) * 60 + clock.m;
  const elapsed = grade === 2 ? rng.int(1, 4) * 60 : rng.pick([15, 25, 35, 45, 50, 65, 80, 95, 125]);
  const target = kind === 'elapsed' ? fromMinutes(start + elapsed) : clock;
  const answer = label(target);
  // Swapped hands: e.g. 6:15 → 3:30. Round to the learner's minute grid.
  const swapped = { h: Math.floor(target.m / 5) || 12, m: (Math.round(((target.h % 12) * 5) / snap) * snap) % 60 };
  const choices = new Set<string>([answer]);
  choices.add(label(swapped));
  if (kind === 'elapsed') choices.add(label(clock));
  for (const delta of rng.shuffle([60, -60, snap, -snap, 120, -120])) {
    if (choices.size === 4) break;
    choices.add(label(fromMinutes((target.h % 12) * 60 + target.m + delta)));
  }
  const shuffled = rng.shuffle([...choices]);
  const duration = elapsed % 60 === 0 ? `${elapsed / 60}시간` : `${elapsed}분`;
  return {
    ...base, id: kind === 'elapsed' ? `${id}+${elapsed}` : id, kind: 'choice', clock,
    prompt: kind === 'elapsed' ? `지금 ${label(clock)}예요. ${duration} 뒤는?` : '시계가 가리키는 시각은?',
    choices: shuffled, answerIndex: shuffled.indexOf(answer),
    hint: kind === 'elapsed' ? '분이 60개 모이면 한 시간이 돼요.' : '짧은 바늘부터 보고 긴 바늘을 살펴봐요.',
    explain: kind === 'elapsed' ? `${label(clock)}에서 ${duration} 뒤는 ${answer}예요.` : `짧은 바늘은 시, 긴 바늘은 분이에요. ${answer}예요.`,
  };
};
