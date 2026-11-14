/**
 * 보호자 모드에 보여 줄 기록 — 과목별 정답률, 자주 틀린 문제, 놀이 시간.
 * 화면(DOM)과 떼어 놓아 테스트하기 쉽게 한다.
 */
import { CHAPTER_IDS, type Grade } from '../types/contracts';
import { englishWords, hanjaList, mannersScenes } from '../learning/data';
import type { ReviewItem, SaveData } from './save';
import { subjectScores, type SubjectScore } from './progress';

export interface ParentReport {
  grade: Grade;
  completed: number;
  totalChapters: number;
  coins: number;
  playSeconds: number;
  sessionSeconds: number;
  subjects: SubjectScore[];
  /** 최근에 틀린 것부터 (최대 8개) */
  missed: string[];
  timeLimit: number;
}

const short = (s: string, n = 26) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** 복습 상자에 든 문제를 보호자가 알아보기 쉬운 한 줄로 */
export function describeMissed(item: ReviewItem): string | null {
  const base = item.id.split(':')[0];
  switch (item.subject) {
    case 'english': {
      const w = englishWords.find((x) => x.id === base);
      return w ? `${w.emoji} ${w.word} (${w.meaningKo})` : null;
    }
    case 'hanja': {
      const c = hanjaList.find((x) => x.id === base);
      return c ? `${c.char} (${c.hun} ${c.eum})` : null;
    }
    case 'manners': {
      const m = mannersScenes.find((x) => x.id === base);
      return m ? `${m.emoji} ${short(m.situation)}` : null;
    }
    case 'math':
      return item.question ? `🔢 ${short(item.question.prompt)}` : null;
    case 'clock': {
      const q = item.question;
      if (!q) return null;
      return q.clock ? `🕒 ${q.clock.h}시 ${String(q.clock.m).padStart(2, '0')}분 — ${short(q.prompt, 18)}` : `🕒 ${short(q.prompt)}`;
    }
    default:
      return null;
  }
}

export function parentReport(data: SaveData, sessionSeconds: number): ParentReport {
  const seen = new Set<string>();
  const missed: string[] = [];
  for (const item of [...data.learning.review].reverse()) {
    const text = describeMissed(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    missed.push(text);
    if (missed.length >= 8) break;
  }
  return {
    grade: data.grade,
    completed: data.completed.length,
    totalChapters: CHAPTER_IDS.length,
    coins: data.coins,
    playSeconds: data.playSeconds,
    sessionSeconds,
    subjects: subjectScores(data),
    missed,
    timeLimit: data.settings.timeLimit ?? 0,
  };
}
