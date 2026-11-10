import { describe, expect, it } from 'vitest';
import { LearningEngine, type QuizPresenter } from '../../src/learning/engine';
import { createSaveStore, emptyProgress, normalizeSave, newSave } from '../../src/game/save';
import { englishQuestion, hanjaQuestion, mannersQuestion } from '../../src/learning/builders';
import { englishWords, hanjaList, mannersScenes } from '../../src/learning/data';
import { createRng } from '../../src/core/rng';
import type { Grade, Question, QuizSlot } from '../../src/types/contracts';
import { validateQuestion } from '../helpers/validate';

function engineWith(answers: boolean[], grade: Grade = 2) {
  const progress = emptyProgress();
  const shown: Question[] = [];
  let i = 0;
  const presenter: QuizPresenter = {
    async present(q) {
      shown.push(q);
      const ok = answers[i++] ?? true;
      return { firstTry: ok, tries: ok ? 1 : 2 };
    },
  };
  let seed = 1;
  const engine = new LearningEngine({
    getGrade: () => grade,
    progress: () => progress,
    onChange: () => {},
    presenter,
    random: () => ((seed = (seed * 16807) % 2147483647) / 2147483647),
  });
  return { engine, progress, shown };
}

describe('문제 만들기 (데이터 → 문제)', () => {
  it('영어·한자·예절 문제가 형식을 지킨다', () => {
    const rng = createRng(3);
    for (const w of englishWords) {
      for (const mode of ['meaning', 'word', 'spell'] as const) {
        expect(validateQuestion(englishQuestion(w, mode, englishWords, 2, rng))).toEqual([]);
      }
    }
    for (const h of hanjaList) {
      for (const mode of ['hunEum', 'find'] as const) {
        expect(validateQuestion(hanjaQuestion(h, mode, hanjaList, 1, rng))).toEqual([]);
      }
    }
    for (const m of mannersScenes) {
      const q = mannersQuestion(m, 1);
      expect(q.choices[q.answerIndex]).toBe(m.choices[m.answerIndex]);
    }
  });
});

describe('학습 엔진', () => {
  it('슬롯 수만큼 묻고, 결과를 통계·복습 상자에 남긴다', async () => {
    const { engine, progress, shown } = engineWith([true, false, true]);
    const slot: QuizSlot = { id: 'g', subject: 'math', placement: 'gate', count: 3 };
    const r = await engine.ask({ reason: 'gate', slot });
    expect(r.correct).toBe(true);
    expect(r.firstTry).toBe(2);
    expect(shown).toHaveLength(3);
    expect(progress.stats.math).toEqual({ total: 3, firstTry: 2 });
    expect(progress.review).toHaveLength(1);
    expect(progress.review[0].question).toBeDefined();
    expect(progress.boxes[shown[1].id]).toBe(1);
  });

  it('ids 로 고정한 항목을 낸다', async () => {
    const { engine, shown } = engineWith([true]);
    await engine.ask({ reason: 'npc', slot: { id: 'f', subject: 'manners', placement: 'npc', count: 1, ids: ['mn-001'] } });
    expect(shown[0].id).toBe('mn-001');
  });

  it('과목마다 문제가 나온다 (데이터가 적어도 멈추지 않음)', () => {
    const { engine } = engineWith([]);
    for (const subject of ['english', 'hanja', 'math', 'clock', 'manners'] as const) {
      for (let i = 0; i < 20; i++) {
        const q = engine.next({ id: 'x', subject, placement: 'shrine', count: 1 });
        expect(q.subject).toBe(subject);
      }
    }
  });

  it('이야기에 맞춘 자리(문장형 템플릿)는 복습 문제 대신 템플릿 문제를 낸다', () => {
    const { engine, progress } = engineWith([]);
    const old = engine.next({ id: 'x', subject: 'math', placement: 'shrine', count: 1 });
    engine.record(old, false);
    expect(progress.review).toHaveLength(1);
    const slot: QuizSlot = {
      id: 'gate-1', subject: 'math', placement: 'gate', count: 1,
      mathTemplate: { op: 'add', text: '통나무 {a}개와 {b}개를 모으면 모두 몇 개?' },
    };
    for (let i = 0; i < 30; i++) expect(engine.next(slot).prompt).toContain('통나무');
  });

  it('맞히면 복습 목록에서 빠진다', () => {
    const { engine, progress } = engineWith([]);
    const q = engine.next({ id: 'x', subject: 'math', placement: 'gate', count: 1 });
    engine.record(q, false);
    expect(progress.review.map((r) => r.id)).toContain(q.id);
    engine.record(q, true);
    expect(progress.review.map((r) => r.id)).not.toContain(q.id);
    expect(progress.boxes[q.id]).toBe(2);
  });
});

describe('저장 데이터', () => {
  it('저장하고 다시 불러온다', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const a = createSaveStore(storage);
    a.create(3);
    a.data!.coins = 42;
    a.flush();
    const b = createSaveStore(storage);
    expect(b.load()?.coins).toBe(42);
    expect(b.data?.grade).toBe(3);
  });

  it('망가진 저장 데이터는 무시하고, 빠진 값은 채운다', () => {
    expect(normalizeSave(null)).toBeNull();
    expect(normalizeSave({ version: 99 })).toBeNull();
    const fixed = normalizeSave({ version: 1, grade: 2, chapter: 'nope', coins: -5 });
    expect(fixed?.chapter).toBe('ch01');
    expect(fixed?.coins).toBe(0);
    expect(fixed?.learning.stats.math).toEqual({ total: 0, firstTry: 0 });
    expect(newSave(1).avatar.helmet).toBe('bronze');
  });

  it('저장소가 없어도 오류 없이 동작한다', () => {
    const s = createSaveStore(null);
    expect(s.load()).toBeNull();
    s.create(1);
    expect(() => s.flush()).not.toThrow();
  });
});
