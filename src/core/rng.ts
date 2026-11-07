/** 결정적 난수 (mulberry32). 같은 seed → 같은 수열. 문제 생성기·지형 생성에 사용 */
export interface Rng {
  /** [0, 1) */
  next(): number;
  /** min 이상 max 이하 정수 */
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  /** 새 배열을 섞어서 반환 (원본 유지) */
  shuffle<T>(arr: readonly T[]): T[];
  chance(p: number): boolean;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick: (arr) => {
      if (arr.length === 0) throw new Error('rng.pick: empty array');
      return arr[Math.floor(next() * arr.length)];
    },
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    chance: (p) => next() < p,
  };
}

/** 문자열 → 32비트 seed (FNV-1a) */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
