/**
 * 학습 데이터(영어·한자·예절) → Question 변환.
 * 데이터가 적을 때(예시 몇 개뿐)도 보기 2~3개로 자연스럽게 동작해야 한다.
 */
import type {
  ChoiceQuestion, EnglishWord, Grade, Hanja, MannersScene, Question, SpellQuestion,
} from '../types/contracts';
import type { Rng } from '../core/rng';

export type EnglishMode = 'meaning' | 'word' | 'spell';
export type HanjaMode = 'hunEum' | 'find';

function pickDistinct<T>(rng: Rng, pool: T[], n: number, key: (x: T) => string, exclude: Set<string>): T[] {
  const out: T[] = [];
  const seen = new Set(exclude);
  for (const x of rng.shuffle(pool)) {
    const k = key(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

function choice(base: Omit<ChoiceQuestion, 'kind' | 'choices' | 'answerIndex'>, answer: string, wrong: string[], rng: Rng): ChoiceQuestion {
  const choices = rng.shuffle([answer, ...wrong]);
  return { ...base, kind: 'choice', choices, answerIndex: choices.indexOf(answer) };
}

/** 학년에 맞는 영어 문제 방식 */
export function englishModeFor(grade: Grade, word: EnglishWord, rng: Rng): EnglishMode {
  const short = word.word.length <= 5 && !word.word.includes(' ');
  if (grade === 1) return rng.chance(0.5) ? 'meaning' : 'word';
  if (grade === 2) return short && rng.chance(0.4) ? 'spell' : rng.chance(0.5) ? 'meaning' : 'word';
  return !word.word.includes(' ') && rng.chance(0.5) ? 'spell' : rng.chance(0.5) ? 'meaning' : 'word';
}

export function englishQuestion(word: EnglishWord, mode: EnglishMode, pool: EnglishWord[], grade: Grade, rng: Rng): Question {
  const others = pool.filter((w) => w.id !== word.id);
  const sameTopic = others.filter((w) => w.topic === word.topic);
  const candidates = sameTopic.length >= 3 ? sameTopic : others;
  if (mode === 'spell') {
    const letters = [...word.word.replace(/ /g, '')];
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('').filter((c) => !letters.includes(c));
    const decoys = rng.shuffle(alphabet).slice(0, grade === 3 ? 3 : 2);
    const q: SpellQuestion = {
      id: `${word.id}:spell`,
      subject: 'english',
      grade,
      kind: 'spell',
      prompt: `'${word.meaningKo}' 을(를) 영어로 써 볼까요?`,
      emoji: word.emoji,
      answer: word.word.replace(/ /g, ''),
      tiles: rng.shuffle([...letters, ...decoys]),
      hint: `첫 글자는 '${letters[0].toUpperCase()}' 예요.`,
      explain: `${word.emoji} ${word.word} = ${word.meaningKo}`,
    };
    return q;
  }
  if (mode === 'meaning') {
    const wrong = pickDistinct(rng, candidates, 3, (w) => w.meaningKo, new Set([word.meaningKo])).map((w) => w.meaningKo);
    return choice(
      {
        id: `${word.id}:meaning`,
        subject: 'english',
        grade,
        prompt: `'${word.word}' 은(는) 무슨 뜻일까요?`,
        emoji: word.emoji,
        hint: `그림을 잘 보세요!`,
        explain: `${word.emoji} ${word.word} = ${word.meaningKo}`,
      },
      word.meaningKo,
      wrong,
      rng,
    );
  }
  const wrong = pickDistinct(rng, candidates, 3, (w) => w.word, new Set([word.word])).map((w) => w.word);
  return choice(
    {
      id: `${word.id}:word`,
      subject: 'english',
      grade,
      prompt: `'${word.meaningKo}' 은(는) 영어로?`,
      emoji: word.emoji,
      hint: `첫 글자는 '${word.word[0].toUpperCase()}' 예요.`,
      explain: `${word.emoji} ${word.word} = ${word.meaningKo}`,
    },
    word.word,
    wrong,
    rng,
  );
}

export function hanjaQuestion(h: Hanja, mode: HanjaMode, pool: Hanja[], grade: Grade, rng: Rng): Question {
  const others = pool.filter((x) => x.id !== h.id);
  const ex = h.exampleWords[0];
  const explain = `${h.char} = ${h.hun} ${h.eum}${ex ? ` · ${ex.hanja}(${ex.reading}) ${ex.meaning}` : ''}`;
  if (mode === 'hunEum') {
    const label = (x: Hanja) => `${x.hun} ${x.eum}`;
    const wrong = pickDistinct(rng, others, 3, label, new Set([label(h)])).map(label);
    return choice(
      {
        id: `${h.id}:hunEum`,
        subject: 'hanja',
        grade,
        prompt: '이 한자의 뜻과 소리는?',
        emoji: h.char,
        hint: ex ? `'${ex.reading}'(${ex.meaning}) 에 들어 있어요.` : '모양을 잘 보세요!',
        explain,
      },
      label(h),
      wrong,
      rng,
    );
  }
  const wrong = pickDistinct(rng, others, 3, (x) => x.char, new Set([h.char])).map((x) => x.char);
  return choice(
    {
      id: `${h.id}:find`,
      subject: 'hanja',
      grade,
      prompt: `'${h.hun} ${h.eum}' 은(는) 어느 한자일까요?`,
      hint: ex ? `'${ex.reading}'(${ex.meaning}) 에 들어 있어요.` : '뜻을 떠올려 보세요!',
      explain,
    },
    h.char,
    wrong,
    rng,
  );
}

export function mannersQuestion(m: MannersScene, grade: Grade): ChoiceQuestion {
  return {
    id: m.id,
    subject: 'manners',
    grade,
    kind: 'choice',
    prompt: m.situation,
    emoji: m.emoji,
    choices: [...m.choices],
    answerIndex: m.answerIndex,
    hint: m.hint,
    explain: m.praise,
  };
}

/** 정답 문자열 (화면 공개용) */
export function answerText(q: Question): string {
  switch (q.kind) {
    case 'choice': return q.choices[q.answerIndex];
    case 'number': return String(q.answer);
    case 'clockSet': return `${q.answer.h}시${q.answer.m ? ` ${q.answer.m}분` : ''}`;
    case 'spell': return q.answer;
    case 'order': return q.answerOrder.map((i) => q.items[i]).join(' → ');
  }
}
