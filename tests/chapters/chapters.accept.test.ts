// [수용 테스트 — Codex B1] npm run test:accept -- tests/chapters
import { describe, expect, it } from 'vitest';
import { chapters } from '../../src/content';
import { CHAPTER_IDS, SUBJECTS, type BossId, type ChapterData, type ChapterId, type IslandId, type Subject } from '../../src/types/contracts';

/** docs/PLAN.md 3-4 챕터 ↔ 학습 매핑 */
const EXPECT: Record<ChapterId, { island: IslandId; boss?: BossId; learning: Subject[] }> = {
  ch01: { island: 'ogygia', learning: ['manners', 'math'] },
  ch02: { island: 'stormSea', learning: ['english'] },
  ch03: { island: 'cyclops', boss: 'polyphemus', learning: ['math', 'english'] },
  ch04: { island: 'lotus', boss: 'lotusKing', learning: ['hanja'] },
  ch05: { island: 'aeolia', learning: ['clock', 'manners'] },
  ch06: { island: 'laestrygonia', boss: 'laestrygonianKing', learning: ['math'] },
  ch07: { island: 'aeaea', boss: 'circe', learning: ['english'] },
  ch08: { island: 'underworld', learning: ['manners', 'hanja'] },
  ch09: { island: 'thrinacia', boss: 'helios', learning: ['clock'] },
  ch10: { island: 'strait', boss: 'scylla', learning: ['math'] },
  ch11: { island: 'sirens', boss: 'sirenQueen', learning: ['english', 'manners'] },
  ch12: { island: 'scheria', learning: ['manners'] },
  ch13: { island: 'ithaca', learning: ['hanja'] },
  ch14: { island: 'ithaca', boss: 'soldierCaptain', learning: ['math'] },
  ch15: { island: 'ithaca', learning: ['manners', 'clock'] },
  ch16: { island: 'ithacaPalace', boss: 'antinous', learning: ['math'] },
  ch17: { island: 'ithacaPalace', learning: ['manners'] },
};

const all = () => CHAPTER_IDS.map((id) => chapters[id]).filter((c): c is ChapterData => !!c);
const texts = (c: ChapterData) =>
  c.scenes.flatMap((s) => s.steps.flatMap((st) => ('text' in st ? [st.text] : []))).join('\n');

describe('B1 챕터 데이터', () => {
  it('17장 파일이 모두 있다', () => {
    expect(CHAPTER_IDS.filter((id) => !chapters[id])).toEqual([]);
  });

  it('섬·보스·학습 과목이 계획과 맞다', () => {
    for (const c of all()) {
      const ex = EXPECT[c.id];
      expect(c.island, c.id).toBe(ex.island);
      expect(c.boss, c.id).toBe(ex.boss);
      for (const s of ex.learning) expect(c.learning, `${c.id} learning`).toContain(s);
    }
  });

  it('learning 의 과목마다 퀴즈 자리가 있다', () => {
    for (const c of all()) {
      for (const s of c.learning) expect(c.quizSlots.some((q) => q.subject === s), `${c.id}: ${s} 퀴즈 자리 없음`).toBe(true);
    }
  });

  it('장마다 시작 장면, 목표 2개 이상, 퀴즈 자리 2개 이상', () => {
    for (const c of all()) {
      expect(c.scenes.some((s) => s.trigger.on === 'chapterStart'), `${c.id} chapterStart`).toBe(true);
      expect(c.objectives.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.quizSlots.length, c.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('보스 장: boss 목표 + 약점 퀴즈(placement boss)', () => {
    for (const c of all()) {
      if (!c.boss) continue;
      expect(c.objectives.some((o) => o.type === 'boss' && o.target === c.boss), `${c.id} boss 목표`).toBe(true);
      expect(c.quizSlots.some((q) => q.placement === 'boss'), `${c.id} boss 퀴즈`).toBe(true);
      expect(c.bgm.boss, `${c.id} bgm.boss`).toBeDefined();
    }
  });

  it('npc·story 퀴즈 자리는 장면이나 목표에서 쓰인다', () => {
    for (const c of all()) {
      const used = new Set([
        ...c.scenes.flatMap((s) => s.steps.flatMap((st) => (st.type === 'quiz' ? [st.slot] : []))),
        ...c.objectives.flatMap((o) => (o.type === 'quiz' && o.target ? [o.target] : [])),
      ]);
      for (const q of c.quizSlots) {
        if (q.placement === 'npc' || q.placement === 'story') expect(used.has(q.id), `${c.id}: 퀴즈 자리 '${q.id}' 를 쓰는 곳이 없음`).toBe(true);
      }
    }
  });

  it('스토리 연결: 프롤로그(아테), 회상 시작 자막, 아이 표기 병기', () => {
    const c1 = chapters.ch01, c2 = chapters.ch02, c3 = chapters.ch03, c7 = chapters.ch07;
    if (c1) expect(c1.scenes.some((s) => s.steps.some((st) => st.type === 'line' && st.speaker === 'athenaOwl')), 'ch01 아테 대사').toBe(true);
    if (c2) expect(c2.scenes.some((s) => s.steps.some((st) => st.type === 'caption' && st.text.includes('떠올'))), 'ch02 회상 자막').toBe(true);
    if (c3) {
      expect(texts(c3)).toContain('폴리페모스');
      expect(texts(c3)).toContain('폴리페오스');
    }
    if (c7) {
      expect(texts(c7)).toContain('욜리꽃');
      expect(texts(c7)).toContain('몰리');
    }
  });

  it('12장은 이야기 순서 맞추기(order), 16장은 4과목 이상 종합', () => {
    if (chapters.ch12) expect(chapters.ch12.quizSlots.some((q) => q.kind === 'order')).toBe(true);
    if (chapters.ch16) expect(new Set(chapters.ch16.quizSlots.map((q) => q.subject)).size).toBeGreaterThanOrEqual(4);
  });

  it('5과목이 전체에 고르게 (과목마다 퀴즈 자리 4개 이상)', () => {
    for (const s of SUBJECTS) {
      const n = all().flatMap((c) => c.quizSlots).filter((q) => q.subject === s).length;
      expect(n, s).toBeGreaterThanOrEqual(4);
    }
  });
});
