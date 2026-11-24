/**
 * 학습 엔진 — 이야기 범위와 복습을 유지하면서 최근에 낸 항목·형식을 되풀이하지 않는다.
 * 틀린 문제는 복습 상자에 남기고, 잠시 다른 문제를 본 뒤 다시 만난다.
 */
import {
  SUBJECTS,
  type AskRequest, type AskResult, type EnglishWord, type Grade, type Hanja, type LearningApi,
  type MannersScene, type Question, type QuizPlacement, type QuizSlot, type Subject,
} from '../types/contracts';
import { createRng, type Rng } from '../core/rng';
import type { LearningProgress } from '../game/save';
import { englishWords, hanjaList, mannersScenes } from './data';
import { generateClock, generateMath } from './generators';
import {
  englishModeFor, englishModesFor, englishQuestion, hanjaQuestion, mannersQuestion,
  type EnglishMode, type HanjaMode,
} from './builders';
import { storyOrderQuestion } from './storyOrder';

export interface PresentContext {
  placement: QuizPlacement;
  index: number;
  total: number;
}

export interface QuizPresenter {
  /** 문제 하나를 풀게 한다. 틀려도 결국 정답을 보고 넘어가며, 첫 시도에 맞혔는지 돌려준다 */
  present(q: Question, ctx: PresentContext): Promise<{ firstTry: boolean; tries: number }>;
}

export interface LearningData {
  english: EnglishWord[];
  hanja: Hanja[];
  manners: MannersScene[];
}

export interface LearningEngineOptions {
  getGrade(): Grade;
  progress(): LearningProgress;
  onChange(): void;
  presenter: QuizPresenter;
  onAnswered?(q: Question, firstTry: boolean): void;
  data?: LearningData;
  random?: () => number;
}

const REVIEW_CHANCE = 0.35;
const MAX_REVIEW = 30;
const RECENT = 12;

export class LearningEngine implements LearningApi {
  private recent: string[] = [];
  private activeProgress: LearningProgress | null = null;
  private data: LearningData;
  private random: () => number;

  constructor(private o: LearningEngineOptions) {
    this.data = o.data ?? { english: englishWords, hanja: hanjaList, manners: mannersScenes };
    this.random = o.random ?? Math.random;
    this.currentProgress();
  }

  async ask(req: AskRequest): Promise<AskResult> {
    const slot: QuizSlot = req.slot ?? {
      id: 'adhoc',
      subject: req.subject ?? this.pickSubject(),
      placement: req.reason,
      count: 1,
    };
    const questionIds: string[] = [];
    let firstTry = 0;
    for (let i = 0; i < slot.count; i++) {
      const q = this.next(slot);
      const r = await this.o.presenter.present(q, { placement: slot.placement, index: i, total: slot.count });
      this.record(q, r.firstTry);
      this.o.onAnswered?.(q, r.firstTry);
      questionIds.push(q.id);
      if (r.firstTry) firstTry++;
    }
    return { correct: true, firstTry, questionIds };
  }

  next(slot: QuizSlot): Question {
    this.currentProgress();
    const grade = this.o.getGrade();
    const rng = createRng(Math.floor(this.random() * 2 ** 31));
    const tailored = !!(slot.ids?.length || slot.mathTemplate || slot.topic || slot.kind || slot.clockType);
    let question: Question | null = null;
    if (!tailored && rng.next() < REVIEW_CHANCE) question = this.fromReview(slot.subject, rng);
    if (!question) {
      question = this.fresh(slot, grade, rng) ?? generateMath({ grade, seed: Math.floor(rng.next() * 1e9) });
      if (slot.subject === 'math' || slot.subject === 'clock' || question.kind === 'order') {
        // 생성기만 다시 뽑는다. 고정 단어·주제 범위는 fresh의 항목 선택에서 지킨다.
        for (let attempt = 1; attempt < RECENT * 2 && this.lastSeen(question.id) >= 0; attempt++) {
          const candidate = this.fresh(slot, grade, rng);
          if (!candidate) break;
          if (this.lastSeen(candidate.id) < this.lastSeen(question.id)) question = candidate;
        }
      }
    }
    this.remember(question.id);
    return question;
  }

  record(q: Question, firstTry: boolean): void {
    const p = this.currentProgress();
    const st = (p.stats[q.subject] ??= { total: 0, firstTry: 0 });
    st.total++;
    if (firstTry) st.firstTry++;
    const box = p.boxes[q.id] ?? 1;
    p.boxes[q.id] = firstTry ? Math.min(3, box + 1) : 1;
    p.review = p.review.filter((r) => r.id !== q.id);
    if (!firstTry) {
      const generated = q.subject === 'math' || q.subject === 'clock' || q.kind === 'order';
      p.review.push({ subject: q.subject, id: q.id, grade: q.grade, question: generated ? q : undefined });
      if (p.review.length > MAX_REVIEW) p.review.splice(0, p.review.length - MAX_REVIEW);
    }
    this.remember(q.id);
    p.recentQuestionIds = [...this.recent];
    this.o.onChange();
  }

  /** 정답률이 낮은 과목을 조금 더 자주 고른다. */
  pickSubject(): Subject {
    const p = this.currentProgress();
    const weights = SUBJECTS.map((s) => {
      const st = p.stats[s];
      const rate = st && st.total > 0 ? st.firstTry / st.total : 0.5;
      return 1.5 - rate;
    });
    let r = this.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < SUBJECTS.length; i++) {
      r -= weights[i];
      if (r <= 0) return SUBJECTS[i];
    }
    return SUBJECTS[0];
  }

  private currentProgress(): LearningProgress {
    const progress = this.o.progress();
    if (progress !== this.activeProgress) {
      this.activeProgress = progress;
      this.recent = [];
      for (const id of (progress.recentQuestionIds ?? []).slice(-RECENT)) this.remember(id);
    }
    return progress;
  }

  private remember(id: string): void {
    this.recent = this.recent.filter((seen) => seen !== id);
    this.recent.push(id);
    if (this.recent.length > RECENT) this.recent.shift();
  }

  private lastSeen(id: string): number {
    for (let i = this.recent.length - 1; i >= 0; i--) {
      if (this.recent[i] === id || this.recent[i].startsWith(id + ':')) return i;
    }
    return -1;
  }

  /** 최근에 안 낸 후보를 먼저, 모두 냈다면 가장 오래전에 만난 후보를 고른다. */
  private available<T>(pool: T[], idOf: (item: T) => string): T[] {
    const ranks = pool.map((item) => this.lastSeen(idOf(item)));
    const oldest = Math.min(...ranks);
    return pool.filter((_, index) => ranks[index] === oldest);
  }

  private variedMode<T extends string>(preferred: T, modes: T[], idOf: (mode: T) => string): T {
    const choices = this.available(modes, idOf);
    return choices.includes(preferred) ? preferred : choices[0];
  }

  private fromReview(subject: Subject, rng: Rng): Question | null {
    const items = this.currentProgress().review.filter((item) => {
      const content = subject === 'english' || subject === 'hanja' ? item.id.split(':')[0] : item.id;
      return item.subject === subject && this.lastSeen(content) < 0;
    });
    if (!items.length) return null;
    const item = rng.pick(items);
    if (item.question) return reshuffle(item.question, rng);
    const [key, mode] = item.id.split(':') as [string, string | undefined];
    if (subject === 'english') {
      const word = this.data.english.find((entry) => entry.id === key);
      return word ? englishQuestion(word, (mode as EnglishMode) ?? 'meaning', this.data.english, item.grade, rng) : null;
    }
    if (subject === 'hanja') {
      const entry = this.data.hanja.find((value) => value.id === key);
      return entry ? hanjaQuestion(entry, (mode as HanjaMode) ?? 'hunEum', this.data.hanja, item.grade, rng) : null;
    }
    if (subject === 'manners') {
      const entry = this.data.manners.find((value) => value.id === key);
      return entry ? reshuffle(mannersQuestion(entry, item.grade), rng) : null;
    }
    return null;
  }

  private fresh(slot: QuizSlot, grade: Grade, rng: Rng): Question | null {
    const seed = Math.floor(rng.next() * 1e9);
    switch (slot.subject) {
      case 'math':
        return generateMath({ grade, seed, template: slot.mathTemplate, format: slot.kind === 'number' ? 'number' : 'choice' });
      case 'clock':
        return generateClock({ grade, seed, type: slot.clockType ?? (slot.kind === 'clockSet' ? 'set' : undefined) });
      case 'english': {
        const pool = this.pool(this.data.english, slot, grade, (word) => word.topic);
        const word = this.choose(pool, rng, (entry) => entry.id);
        if (!word) return null;
        const modes: EnglishMode[] = slot.kind === 'spell' ? ['spell']
          : slot.kind === 'choice' ? ['meaning', 'word'] : englishModesFor(grade, word);
        const preferred: EnglishMode = slot.kind === 'spell' ? 'spell'
          : slot.kind === 'choice' ? (rng.chance(0.5) ? 'meaning' : 'word') : englishModeFor(grade, word, rng);
        const mode = this.variedMode(preferred, modes, (value) => word.id + ':' + value);
        return englishQuestion(word, mode, this.data.english, grade, rng);
      }
      case 'hanja': {
        const pool = this.pool(this.data.hanja, slot, grade, () => undefined);
        const entry = this.choose(pool, rng, (value) => value.id);
        if (!entry) return null;
        const mode = this.variedMode<HanjaMode>(rng.chance(grade === 1 ? 0.7 : 0.5) ? 'hunEum' : 'find',
          ['hunEum', 'find'], (value) => entry.id + ':' + value);
        return hanjaQuestion(entry, mode, this.data.hanja, grade, rng);
      }
      case 'manners': {
        if (slot.id === 'story-order' && slot.kind === 'order' && !slot.ids?.length) return storyOrderQuestion(grade, rng);
        const pool = this.pool(this.data.manners, slot, grade, (entry) => entry.category);
        const entry = this.choose(pool, rng, (value) => value.id);
        return entry ? reshuffle(mannersQuestion(entry, grade), rng) : null;
      }
    }
  }

  private pool<T extends { id: string; grade: Grade }>(all: T[], slot: QuizSlot, grade: Grade, topicOf: (item: T) => string | undefined): T[] {
    if (slot.ids?.length) {
      const fixed = all.filter((item) => slot.ids!.includes(item.id));
      if (fixed.length) return fixed;
    }
    let list = slot.topic ? all.filter((item) => topicOf(item) === slot.topic) : all;
    if (!list.length) list = all;
    const byGrade = list.filter((item) => item.grade <= grade);
    return byGrade.length ? byGrade : list;
  }

  private choose<T>(pool: T[], rng: Rng, idOf: (item: T) => string): T | null {
    if (!pool.length) return null;
    const candidates = this.available(pool, idOf);
    const boxes = Object.entries(this.currentProgress().boxes);
    const weights = candidates.map((item) => {
      const id = idOf(item);
      const levels = boxes.filter(([key]) => key === id || key.startsWith(id + ':')).map(([, value]) => value);
      const box = levels.length ? Math.min(...levels) : undefined;
      return box === undefined ? 2 : box === 1 ? 3 : box === 2 ? 1 : 0.5;
    });
    let r = rng.next() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }
}

function reshuffle(q: Question, rng: Rng): Question {
  if (q.kind === 'order') {
    const indices = rng.shuffle(q.items.map((_, index) => index));
    return { ...q, items: indices.map((index) => q.items[index]), answerOrder: q.answerOrder.map((index) => indices.indexOf(index)) };
  }
  if (q.kind !== 'choice') return q;
  const answer = q.choices[q.answerIndex];
  const choices = rng.shuffle(q.choices);
  return { ...q, choices, answerIndex: choices.indexOf(answer) };
}
