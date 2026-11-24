import { describe, expect, it } from 'vitest';
import { LearningEngine } from '../../src/learning/engine';
import { answerText } from '../../src/learning/builders';
import { englishWords, mannersScenes } from '../../src/learning/data';
import { chapters } from '../../src/content';
import { createRng } from '../../src/core/rng';
import { emptyProgress, type LearningProgress } from '../../src/game/save';
import type { Grade, Question, QuizSlot } from '../../src/types/contracts';
import { validateQuestion } from '../helpers/validate';

function setup(grade: Grade = 2, random?: () => number, initial = emptyProgress()) {
  let progress = initial;
  const shown: Question[] = [];
  const rng = createRng(71);
  const engine = new LearningEngine({
    getGrade: () => grade,
    progress: () => progress,
    random: random ?? rng.next,
    onChange() {},
    presenter: {
      async present(question) {
        shown.push(question);
        return { firstTry: true, tries: 1 };
      },
    },
  });
  return { engine, shown, get progress() { return progress; }, replaceProgress(value: LearningProgress) { progress = value; } };
}

const slot = (values: Partial<QuizSlot> = {}): QuizSlot => ({
  id: 'variety', subject: 'english', placement: 'story', count: 1, ...values,
});
const content = (question: Question) => question.id.split(':')[0];

describe('최근에 낸 문제와 이야기 범위', () => {
  it('고정 단어를 모두 만나기 전에 반복하지 않고, 작은 풀에서는 오래된 단어부터 돌아온다', () => {
    const { engine } = setup(2, () => 0.5);
    const fixed = ['en-pig', 'en-lion', 'en-wolf'];
    const sequence = Array.from({ length: 15 }, () => engine.next(slot({ ids: fixed, kind: 'choice' })));
    for (const question of sequence) {
      expect(fixed).toContain(content(question));
      expect(question.kind).toBe('choice');
    }
    for (let index = 0; index <= sequence.length - fixed.length; index++) {
      expect(new Set(sequence.slice(index, index + fixed.length).map(content)).size).toBe(fixed.length);
    }
  });

  it('다른 장의 슬롯에서도 겹친 단어를 바로 반복하지 않으며 새 슬롯의 지정 범위를 지킨다', () => {
    const { engine } = setup(2, () => 0.5);
    expect(content(engine.next(slot({ id: 'gate-animals', ids: ['en-pig'] })))).toBe('en-pig');
    const next = engine.next(slot({ id: 'boss-animals', ids: ['en-pig', 'en-dog'] }));
    expect(content(next)).toBe('en-dog');
  });

  it('주제와 학년 범위를 넓히지 않고 가능한 최근 단어를 피한다', () => {
    const { engine } = setup(1, () => 0.5);
    const allowed = englishWords.filter((word) => word.topic === 'sea' && word.grade <= 1).map((word) => word.id);
    const window = Math.min(12, allowed.length - 1);
    const previous: string[] = [];
    for (let index = 0; index < 35; index++) {
      const question = engine.next(slot({ topic: 'sea', kind: 'choice' }));
      const id = content(question);
      expect(allowed).toContain(id);
      expect(previous.slice(-window)).not.toContain(id);
      previous.push(id);
    }
  });

  it.each([1, 2, 3] as const)('%s학년: 한 단어만 있어도 허용된 문제 방식이 순환한다', (grade) => {
    const { engine } = setup(grade, () => 0.5);
    const questions = Array.from({ length: 9 }, () => engine.next(slot({ ids: ['en-pig'] })));
    const modes = questions.map((question) => question.id.split(':')[1]);
    expect(new Set(modes).size).toBe(grade === 1 ? 2 : 3);
    if (grade === 1) expect(modes).not.toContain('spell');
    for (let index = 1; index < questions.length; index++) expect(questions[index].id).not.toBe(questions[index - 1].id);
  });

  it('긴 낱말의 2학년 철자를 피하면서 명시적인 철자 슬롯은 그대로 지킨다', () => {
    const word = englishWords.find((entry) => entry.word.length > 5 && !entry.word.includes(' '))!;
    const { engine } = setup(2, () => 0.5);
    const questions = Array.from({ length: 6 }, () => engine.next(slot({ ids: [word.id] })));
    expect(questions.every((question) => question.kind === 'choice')).toBe(true);
    const spelling = engine.next(slot({ ids: [word.id], kind: 'spell' }));
    expect(spelling.kind).toBe('spell');
    expect(content(spelling)).toBe(word.id);
  });

  it('한자 하나의 뜻 묻기와 한자 찾기를 번갈아 낸다', () => {
    const { engine } = setup(1, () => 0.5);
    const questions = Array.from({ length: 8 }, () => engine.next(slot({ subject: 'hanja', ids: ['hj-家'] })));
    expect(new Set(questions.map((question) => question.id)).size).toBe(2);
    for (let index = 1; index < questions.length; index++) expect(questions[index].id).not.toBe(questions[index - 1].id);
  });

  it.each(['math', 'clock'] as const)('%s 생성 문제는 같은 난수 시작값에서도 최근 12문제를 되풀이하지 않는다', (subject) => {
    const { engine } = setup(2, () => 0.5);
    const recent: string[] = [];
    const quiz = subject === 'math'
      ? slot({ subject, kind: 'number', mathTemplate: { op: 'add', text: '통나무 {a}개와 {b}개를 합쳐요.' } })
      : slot({ subject, clockType: 'set' });
    for (let index = 0; index < 40; index++) {
      const question = engine.next(quiz);
      expect(validateQuestion(question)).toEqual([]);
      expect(recent.slice(-12)).not.toContain(question.id);
      if (subject === 'math') {
        expect(question.kind).toBe('number');
        expect(question.prompt).toContain('통나무');
      } else expect(question.kind).toBe('clockSet');
      recent.push(question.id);
    }
  });

  it('고정 예절 장면의 내용과 정답을 지키면서 보기 위치를 바꾼다', () => {
    const { engine } = setup();
    const scene = mannersScenes[0];
    const indices = new Set<number>();
    for (let index = 0; index < 18; index++) {
      const question = engine.next(slot({ subject: 'manners', ids: [scene.id] }));
      expect(question.id).toBe(scene.id);
      expect(question.prompt).toBe(scene.situation);
      expect(answerText(question)).toBe(scene.choices[scene.answerIndex]);
      if (question.kind !== 'choice') throw new Error('예절은 보기 문제여야 한다');
      expect(new Set(question.choices)).toEqual(new Set(scene.choices));
      indices.add(question.answerIndex);
    }
    expect(indices.size).toBeGreaterThan(1);
  });
});

describe('복습과 적응형 학습 유지', () => {
  it('다른 방식으로 방금 만난 단어의 복습도 잠시 미루고, 시간이 지나면 다시 낸다', () => {
    const { engine, progress } = setup(2, () => 0);
    progress.review.push({ subject: 'english', id: 'en-pig:spell', grade: 2 });
    engine.next(slot({ ids: ['en-pig'], kind: 'choice' }));
    const fresh = engine.next(slot({ placement: 'shrine' }));
    expect(content(fresh)).not.toBe('en-pig');
    expect(progress.review).toHaveLength(1);
    for (let index = 0; index < 12; index++) engine.next(slot({ subject: 'math', placement: 'shrine' }));
    const review = engine.next(slot({ placement: 'shrine' }));
    expect(review.id).toBe('en-pig:spell');
    engine.record(review, true);
    expect(progress.review).toEqual([]);
    expect(progress.boxes[review.id]).toBe(2);
  });

  it('먼저 저장된 쉬운 방식에 가려지지 않고 약한 방식이 남은 단어를 더 자주 고른다', () => {
    const progress = emptyProgress();
    progress.boxes = { 'en-pig:meaning': 3, 'en-pig:spell': 1, 'en-cat:meaning': 3, 'en-cat:word': 3 };
    const rng = createRng(912);
    const counts = { pig: 0, cat: 0 };
    for (let index = 0; index < 500; index++) {
      const { engine } = setup(2, rng.next, progress);
      const question = engine.next(slot({ ids: ['en-pig', 'en-cat'], kind: 'choice' }));
      if (content(question) === 'en-pig') counts.pig++;
      else counts.cat++;
    }
    expect(counts.pig).toBeGreaterThan(counts.cat * 3);
  });

  it('정답률이 낮은 과목을 더 자주 고르는 가중치는 유지한다', () => {
    const { engine, progress } = setup();
    for (const stats of Object.values(progress.stats)) Object.assign(stats, { total: 100, firstTry: 100 });
    progress.stats.math.firstTry = 0;
    const counts = { math: 0, english: 0 };
    for (let index = 0; index < 1000; index++) {
      const subject = engine.pickSubject();
      if (subject === 'math' || subject === 'english') counts[subject]++;
    }
    expect(counts.math).toBeGreaterThan(counts.english * 2);
  });
});

describe('이력 저장과 저장 슬롯 전환', () => {
  it('최근 12개를 저장하고 다시 실행해도 최근 문제를 피한다', async () => {
    const { engine, progress } = setup(2, () => 0.5);
    await engine.ask({ reason: 'gate', slot: slot({ subject: 'math', count: 18 }) });
    const history = [...progress.recentQuestionIds!];
    expect(history).toHaveLength(12);
    expect(new Set(history).size).toBe(12);
    const restored = setup(2, () => 0.5, structuredClone(progress));
    expect(history).not.toContain(restored.engine.next(slot({ subject: 'math' })).id);
    expect(progress.recentQuestionIds).toEqual(history);
  });

  it('같은 엔진으로 새 게임을 열면 이전 게임 이력 대신 새 저장의 이력을 쓴다', () => {
    const current = setup(2, () => 0.5);
    const fixed = slot({ ids: ['en-pig', 'en-cat'], kind: 'choice' });
    const first = current.engine.next(fixed);
    current.engine.record(first, true);
    current.replaceProgress(emptyProgress());
    expect(current.engine.next(fixed).id).toBe(first.id);
    const otherSave = emptyProgress();
    otherSave.recentQuestionIds = [first.id];
    current.replaceProgress(otherSave);
    expect(content(current.engine.next(fixed))).not.toBe(content(first));
  });

  it('같은 seed 수열과 진행 상황으로 같은 문제 수열을 만든다', () => {
    const a = setup();
    const b = setup();
    const slots = [
      slot({ ids: ['en-pig', 'en-dog'] }), slot({ subject: 'math' }),
      slot({ subject: 'clock' }), slot({ subject: 'manners', topic: 'table' }),
    ];
    const from = (engine: LearningEngine) => Array.from({ length: 24 }, (_, index) => engine.next(slots[index % slots.length]));
    expect(from(a.engine)).toEqual(from(b.engine));
  });
});

describe('12장 지난 모험 순서 맞추기', () => {
  const story = chapters.ch12!.quizSlots.find((entry) => entry.id === 'story-order')!;
  const memories = Object.values(chapters).filter((chapter) => chapter && chapter.no >= 3 && chapter.no <= 11);

  it.each([1, 2, 3] as const)('%s학년의 순서 항목은 실제 3~11장 제목과 연대 순서에 맞는다', (grade) => {
    const { engine } = setup(grade);
    const question = engine.next(story);
    expect(question.kind).toBe('order');
    expect(question.subject).toBe(story.subject);
    expect(validateQuestion(question)).toEqual([]);
    if (question.kind !== 'order') throw new Error('12장은 순서 문제여야 한다');
    expect(question.items).toHaveLength(grade + 2);
    const correct = question.answerOrder.map((index) => memories.find((chapter) => chapter?.title === question.items[index])?.no);
    expect(correct.every((number) => number !== undefined)).toBe(true);
    expect(correct).toEqual([...correct].sort((a, b) => a! - b!));
  });

  it('틀린 순서 문제도 장면 id를 학습 데이터에서 찾지 않고 저장된 문제로 복습한다', () => {
    const { engine, progress } = setup(2, () => 0);
    const question = engine.next(story);
    engine.record(question, false);
    expect(progress.review[0].question).toEqual(question);
    for (let index = 0; index < 12; index++) engine.next(slot({ subject: 'math', placement: 'shrine' }));
    const review = engine.next(slot({ subject: 'manners', placement: 'shrine' }));
    expect(review.id).toBe(question.id);
    expect(review.kind).toBe('order');
    expect(answerText(review)).toBe(answerText(question));
    expect(progress.review[0].question).toEqual(question);
    engine.record(review, true);
    expect(progress.review).toEqual([]);
  });
});
