/**
 * 저장 데이터 (localStorage). 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서도
 * 게임은 메모리로 계속 돌아가야 하므로 모든 접근을 try/catch 로 감싼다.
 */
import {
  CHAPTER_IDS, DEFAULT_AVATAR, SUBJECTS,
  type AvatarCustomization, type ChapterId, type Grade, type Question, type Subject,
} from '../types/contracts';

export interface ReviewItem {
  subject: Subject;
  /** Question.id */
  id: string;
  grade: Grade;
  /** 수학·시계(생성기) 문제는 문제 자체를 저장해 두었다가 다시 낸다 */
  question?: Question;
}

export interface LearningProgress {
  /** Question.id → 복습 상자 1~3 (1 = 자주 다시 냄) */
  boxes: Record<string, number>;
  stats: Record<Subject, { total: number; firstTry: number }>;
  review: ReviewItem[];
}

export interface SaveData {
  version: 1;
  grade: Grade;
  avatar: AvatarCustomization;
  coins: number;
  /** 다음에 플레이할 장 */
  chapter: ChapterId;
  completed: ChapterId[];
  /** 연 보물상자 '섬:id' */
  opened: string[];
  /** 푼 부엉이 신전 '섬:id' */
  shrines: string[];
  learning: LearningProgress;
  settings: { master: number; sfx: number; bgm: number };
  playSeconds: number;
  createdAt: number;
  updatedAt: number;
}

const KEY = 'odyseey.save.v1';

export function emptyProgress(): LearningProgress {
  const stats = {} as LearningProgress['stats'];
  for (const s of SUBJECTS) stats[s] = { total: 0, firstTry: 0 };
  return { boxes: {}, stats, review: [] };
}

export function newSave(grade: Grade): SaveData {
  const now = Date.now();
  return {
    version: 1,
    grade,
    avatar: { ...DEFAULT_AVATAR },
    coins: 0,
    chapter: 'ch01',
    completed: [],
    opened: [],
    shrines: [],
    learning: emptyProgress(),
    settings: { master: 0.9, sfx: 0.8, bgm: 0.6 },
    playSeconds: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** 오래되거나 일부가 빠진 저장 데이터를 안전하게 보정 */
export function normalizeSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<SaveData>;
  if (r.version !== 1) return null;
  const grade = r.grade === 1 || r.grade === 2 || r.grade === 3 ? r.grade : 1;
  const base = newSave(grade);
  const progress = emptyProgress();
  const learning = r.learning ?? progress;
  for (const s of SUBJECTS) {
    progress.stats[s] = learning.stats?.[s] ?? { total: 0, firstTry: 0 };
  }
  return {
    ...base,
    ...r,
    grade,
    avatar: { ...DEFAULT_AVATAR, ...(r.avatar ?? {}) },
    chapter: CHAPTER_IDS.includes(r.chapter as ChapterId) ? (r.chapter as ChapterId) : 'ch01',
    completed: (r.completed ?? []).filter((c) => CHAPTER_IDS.includes(c)),
    opened: r.opened ?? [],
    shrines: r.shrines ?? [],
    learning: { boxes: learning.boxes ?? {}, stats: progress.stats, review: learning.review ?? [] },
    settings: { ...base.settings, ...(r.settings ?? {}) },
    coins: Math.max(0, Number(r.coins) || 0),
  };
}

export interface SaveStore {
  data: SaveData | null;
  load(): SaveData | null;
  create(grade: Grade): SaveData;
  /** 바뀐 내용을 저장 (짧은 시간에 여러 번 불러도 한 번만 씀) */
  touch(): void;
  flush(): void;
  clear(): void;
}

export function createSaveStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeLocalStorage()): SaveStore {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const store: SaveStore = {
    data: null,
    load() {
      try {
        const text = storage?.getItem(KEY);
        store.data = text ? normalizeSave(JSON.parse(text)) : null;
      } catch {
        store.data = null;
      }
      return store.data;
    },
    create(grade) {
      store.data = newSave(grade);
      store.flush();
      return store.data;
    },
    touch() {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        store.flush();
      }, 400);
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (!store.data) return;
      store.data.updatedAt = Date.now();
      try {
        storage?.setItem(KEY, JSON.stringify(store.data));
      } catch {
        /* 저장 공간이 없어도 게임은 계속 */
      }
    },
    clear() {
      store.data = null;
      try {
        storage?.removeItem(KEY);
      } catch {
        /* 무시 */
      }
    },
  };
  return store;
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
