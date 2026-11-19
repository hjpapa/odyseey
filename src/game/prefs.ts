/**
 * 기기별 화면 설정 — 큰 글씨, 번쩍임·흔들림 줄이기.
 * 저장 슬롯과 따로 둔다: 처음 화면에서도 바꿀 수 있고, '처음부터'를 눌러도 그대로 남는다.
 */
export interface Prefs {
  bigText: boolean;
  /** 화면 번쩍임·카메라 흔들림·큰 움직임을 줄인다 */
  calm: boolean;
}

const KEY = 'odyseey.prefs.v1';

/** 저장된 글을 읽는다. 없거나 깨졌으면 기본값 (기기의 '동작 줄이기' 설정을 따른다) */
export function parsePrefs(text: string | null, reduceMotion: boolean): Prefs {
  const base: Prefs = { bigText: false, calm: reduceMotion };
  if (!text) return base;
  try {
    const raw = JSON.parse(text) as Partial<Prefs> | null;
    return {
      bigText: typeof raw?.bigText === 'boolean' ? raw.bigText : base.bigText,
      calm: typeof raw?.calm === 'boolean' ? raw.calm : base.calm,
    };
  } catch {
    return base;
  }
}

function read(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

const reduceMotion = () => (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) || false;

/** 게임 어디서나 읽는 현재 설정 */
export const prefs: Prefs = parsePrefs(read(), reduceMotion());

/** 설정을 화면(CSS)에 반영한다 */
export function applyPrefs() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.text = prefs.bigText ? 'big' : 'normal';
  root.dataset.calm = prefs.calm ? '1' : '0';
}

export function setPref(key: keyof Prefs, value: boolean) {
  prefs[key] = value;
  applyPrefs();
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* 저장할 수 없어도 지금 화면에는 적용된다 */
  }
}
