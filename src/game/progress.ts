/**
 * 진행 상황 계산 — 바다 지도·엔딩 성적표·보호자 모드가 함께 쓴다 (DOM·three 없음, 테스트 쉬움)
 */
import {
  CHAPTER_IDS, SUBJECTS, SUBJECT_LABEL,
  type ChapterData, type ChapterId, type IslandId, type IslandLayout, type Subject,
} from '../types/contracts';
import type { SaveData } from './save';

/** done: 끝낸 장 / next: 지금 할 차례 / locked: 앞 장을 끝내면 열림 */
export type ChapterState = 'done' | 'next' | 'locked';

export function chapterState(data: Pick<SaveData, 'chapter' | 'completed'> | null, id: ChapterId): ChapterState {
  if (data?.completed.includes(id)) return 'done';
  return id === (data?.chapter ?? 'ch01') ? 'next' : 'locked';
}

/**
 * 장을 끝낸 뒤 '다음에 할 장'. 지도에서 앞 장을 다시 해도 이미 연 곳보다 뒤로 가지 않는다.
 * 마지막 장을 끝내면 그 자리에 머문다.
 */
export function advanceFrontier(current: ChapterId, finished: ChapterId): ChapterId {
  const next = CHAPTER_IDS[CHAPTER_IDS.indexOf(finished) + 1] ?? finished;
  return CHAPTER_IDS.indexOf(next) > CHAPTER_IDS.indexOf(current) ? next : current;
}

/** 이야기 순서대로 섬 (각 섬의 첫 장 기준) */
export function islandRoute(chapters: Partial<Record<ChapterId, ChapterData>>): IslandId[] {
  const out: IslandId[] = [];
  for (const id of CHAPTER_IDS) {
    const island = chapters[id]?.island;
    if (island && !out.includes(island)) out.push(island);
  }
  return out;
}

/** 섬 하나의 장들을 합친 상태 — 하나라도 '지금 차례'면 next, 모두 끝냈으면 done */
export function islandState(states: ChapterState[]): ChapterState {
  if (states.includes('next')) return 'next';
  if (states.length > 0 && states.every((s) => s === 'done')) return 'done';
  return states.includes('done') ? 'done' : 'locked';
}

export interface Finds {
  chests: number;
  chestTotal: number;
  shrines: number;
  shrineTotal: number;
}

/** 연 보물상자·푼 부엉이 신전 (저장 키는 '섬:id') */
export function islandFinds(data: Pick<SaveData, 'opened' | 'shrines'> | null, layout: IslandLayout): Finds {
  const has = (list: string[] | undefined, id: string) => list?.includes(`${layout.id}:${id}`) ?? false;
  return {
    chests: layout.chests.filter((c) => has(data?.opened, c.id)).length,
    chestTotal: layout.chests.length,
    shrines: layout.shrines.filter((s) => has(data?.shrines, s.id)).length,
    shrineTotal: layout.shrines.length,
  };
}

export function totalFinds(data: Pick<SaveData, 'opened' | 'shrines'> | null, layouts: IslandLayout[]): Finds {
  const sum: Finds = { chests: 0, chestTotal: 0, shrines: 0, shrineTotal: 0 };
  for (const l of layouts) {
    const f = islandFinds(data, l);
    sum.chests += f.chests;
    sum.chestTotal += f.chestTotal;
    sum.shrines += f.shrines;
    sum.shrineTotal += f.shrineTotal;
  }
  return sum;
}

export interface SubjectScore {
  subject: Subject;
  label: string;
  total: number;
  firstTry: number;
}

export function subjectScores(data: Pick<SaveData, 'learning'>): SubjectScore[] {
  return SUBJECTS.map((s) => ({
    subject: s,
    label: SUBJECT_LABEL[s],
    total: data.learning.stats[s]?.total ?? 0,
    firstTry: data.learning.stats[s]?.firstTry ?? 0,
  }));
}

/** 예: 3725 → '1시간 2분', 59 → '1분 미만' */
export function formatPlayTime(seconds: number): string {
  const min = Math.floor(Math.max(0, seconds) / 60);
  if (min < 1) return '1분 미만';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}
