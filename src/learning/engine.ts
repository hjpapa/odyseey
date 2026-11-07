/**
 * 학습 엔진 — 퀴즈 자리(QuizSlot)에 맞는 문제를 골라 보여 주고, 결과를 복습 상자에 기록한다.
 * - 틀려도 벌은 없다: 힌트 → 다시 도전 → 그래도 어려우면 정답과 설명을 보고 넘어간다.
 * - 틀린 문제는 복습 목록에 들어가 나중에 다시 나온다 (라이트너 상자 1~3).
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
import { englishModeFor, englishQuestion, hanjaQuestion, mannersQuestion, type EnglishMode, type HanjaMode } from './builders';

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
  /** 저장 데이터 안의 진행 상황 (직접 고쳐 쓴다) */
  progress(): LearningProgress;
  onChange(): void;
  presenter: QuizPresenter;
  onAnswered?(q: Question, firstTry: boolean): void;
  data?: LearningData;
  random?: () => number;
}

const REVIEW_CHANCE = 0.35;
const MAX_REVIEW = 30;
const RECENT = 8;

export class LearningEngine implements LearningApi {
  private recent: string[] = [];
  private data: LearningData;
  private random: () => number;

  constructor(private o: LearningEngineOptions) {
    this.data = o.data ?? { english: englishWords, hanja: hanjaList, manners: mannersScenes };
    this.random = o.random ?? Math.random;
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

  /** 다음 문제 고르기 */
  next(slot: QuizSlot): Question {
    const grade = this.o.getGrade();
    const rng = createRng(Math.floor(this.random() * 2 ** 31));
    if (!slot.ids?.length && rng.next() < REVIEW_CHANCE) {
      const review = this.fromReview(slot.subject, rng);
      if (review) return review;
    }
    return this.fresh(slot, grade, rng) ?? generateMath({ grade, seed: Math.floor(rng.next() * 1e9) });
  }

  /** 결과 기록 — 복습 상자와 통계 */
  record(q: Question, firstTry: boolean): void {
    const p = this.o.progress();
    const st = (p.stats[q.subject] ??= { total: 0, firstTry: 0 });
    st.total++;
    if (firstTry) st.firstTry++;
    const box = p.boxes[q.id] ?? 1;
    p.boxes[q.id] = firstTry ? Math.min(3, box + 1) : 1;
    p.review = p.review.filter((r) => r.id !== q.id);
    if (!firstTry) {
      const generated = q.subject === 'math' || q.subject === 'clock';
      p.review.push({ subject: q.subject, id: q.id, grade: q.grade, question: generated ? q : undefined });
      if (p.review.length > MAX_REVIEW) p.review.splice(0, p.review.length - MAX_REVIEW);
    }
    this.recent.push(q.id);
    if (this.recent.length > RECENT) this.recent.shift();
    this.o.onChange();
  }

  /** 정답률이 낮은 과목을 조금 더 자주 (부엉이 신전 등 즉석 출제) */
  pickSubject(): Subject {
    const p = this.o.progress();
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

  private fromReview(subject: Subject, rng: Rng): Question | null {
    const items = this.o.progress().review.filter((r) => r.subject === subject && !this.recent.includes(r.id));
    if (items.length === 0) return null;
    const item = rng.pick(items);
    if (item.question) return reshuffle(item.question, rng);
    const [key, mode] = item.id.split(':') as [string, string | undefined];
    if (subject === 'english') {
      const w = this.data.english.find((x) => x.id === key);
      return w ? englishQuestion(w, (mode as EnglishMode) ?? 'meaning', this.data.english, item.grade, rng) : null;
    }
    if (subject === 'hanja') {
      const h = this.data.hanja.find((x) => x.id === key);
      return h ? hanjaQuestion(h, (mode as HanjaMode) ?? 'hunEum', this.data.hanja, item.grade, rng) : null;
    }
    if (subject === 'manners') {
      const m = this.data.manners.find((x) => x.id === key);
      return m ? mannersQuestion(m, item.grade) : null;
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
        const pool = this.pool(this.data.english, slot, grade, (w) => w.topic);
        const w = this.choose(pool, rng, (x) => x.id);
        if (!w) return null;
        const mode: EnglishMode =
          slot.kind === 'spell' ? 'spell' : slot.kind === 'choice' ? (rng.chance(0.5) ? 'meaning' : 'word') : englishModeFor(grade, w, rng);
        return englishQuestion(w, mode, this.data.english, grade, rng);
      }
      case 'hanja': {
        const pool = this.pool(this.data.hanja, slot, grade, () => undefined);
        const h = this.choose(pool, rng, (x) => x.id);
        if (!h) return null;
        const mode: HanjaMode = rng.chance(grade === 1 ? 0.7 : 0.5) ? 'hunEum' : 'find';
        return hanjaQuestion(h, mode, this.data.hanja, grade, rng);
      }
      case 'manners': {
        const pool = this.pool(this.data.manners, slot, grade, (m) => m.category);
        const m = this.choose(pool, rng, (x) => x.id);
        return m ? mannersQuestion(m, grade) : null;
      }
    }
  }

  /** 슬롯 조건(ids → topic → 학년)으로 후보 좁히기. 너무 좁으면 단계적으로 넓힌다 */
  private pool<T extends { id: string; grade: Grade }>(all: T[], slot: QuizSlot, grade: Grade, topicOf: (x: T) => string | undefined): T[] {
    if (slot.ids?.length) {
      const fixed = all.filter((x) => slot.ids!.includes(x.id));
      if (fixed.length) return fixed;
    }
    let list = slot.topic ? all.filter((x) => topicOf(x) === slot.topic) : all;
    if (list.length === 0) list = all;
    const byGrade = list.filter((x) => x.grade <= grade);
    return byGrade.length ? byGrade : list;
  }

  /** 틀린 것·처음 보는 것을 먼저, 방금 낸 것은 피해서 */
  private choose<T>(pool: T[], rng: Rng, idOf: (x: T) => string): T | null {
    if (pool.length === 0) return null;
    const boxes = this.o.progress().boxes;
    const weightOf = (x: T) => {
      const id = idOf(x);
      const box = Object.entries(boxes).find(([k]) => k === id || k.startsWith(`${id}:`))?.[1];
      let w = box === undefined ? 2 : box === 1 ? 3 : box === 2 ? 1 : 0.5;
      if (this.recent.some((r) => r === id || r.startsWith(`${id}:`))) w *= 0.05;
      return w;
    };
    const weights = pool.map(weightOf);
    let r = rng.next() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }
}

/** 저장해 둔 보기 문제는 보기 순서를 다시 섞어서 낸다 */
function reshuffle(q: Question, rng: Rng): Question {
  if (q.kind !== 'choice') return q;
  const answer = q.choices[q.answerIndex];
  const choices = rng.shuffle(q.choices);
  return { ...q, choices, answerIndex: choices.indexOf(answer) };
}
