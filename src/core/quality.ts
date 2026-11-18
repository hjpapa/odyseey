/**
 * 화질 단계 — 저사양 태블릿에서도 부드럽게.
 * 처음에는 기기에 맞춰 고르고, 실제로 느리면 한 단계씩 낮춰 그 기기에 기억해 둔다.
 */
export interface QualityTier {
  /** 픽셀 비율 상한 */
  ratio: number;
  /** 그림자 지도 크기 (0 이면 그림자 없음) */
  shadowMap: number;
  /** 그림자를 몇 프레임마다 다시 그릴지 */
  shadowEvery: number;
  /** 바다 격자 칸 수 */
  waterSeg: number;
  /** 바다를 빛 반사 없이 가볍게 그릴지 */
  simpleWater: boolean;
}

export const TIERS: readonly QualityTier[] = [
  { ratio: 1, shadowMap: 0, shadowEvery: 0, waterSeg: 40, simpleWater: true },
  { ratio: 1.5, shadowMap: 1024, shadowEvery: 2, waterSeg: 60, simpleWater: true },
  { ratio: 2, shadowMap: 2048, shadowEvery: 1, waterSeg: 90, simpleWater: false },
];

export const TOP_LEVEL = TIERS.length - 1;
const KEY = 'odyseey.quality.v1';

export interface DeviceHints {
  touch: boolean;
  cores?: number;
  memoryGb?: number;
}

/** 저장된 단계가 있으면 그것, 없으면 기기 정보로 고른다 */
export function initialLevel(stored: string | null, d: DeviceHints): number {
  const saved = Number(stored);
  if (stored !== null && stored !== '' && Number.isInteger(saved) && saved >= 0 && saved <= TOP_LEVEL) return saved;
  if ((d.memoryGb !== undefined && d.memoryGb <= 2) || (d.cores !== undefined && d.cores <= 2)) return 0;
  return d.touch ? 1 : TOP_LEVEL;
}

function readStored(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function hints(): DeviceHints {
  if (typeof navigator === 'undefined') return { touch: false };
  const nav = navigator as Navigator & { deviceMemory?: number };
  return { touch: nav.maxTouchPoints > 0, cores: nav.hardwareConcurrency || undefined, memoryGb: nav.deviceMemory };
}

let level = initialLevel(readStored(), hints());

export const qualityLevel = () => level;
export const qualityTier = (): QualityTier => TIERS[level];

/**
 * 한 단계 낮춘다. 더 낮출 수 없으면 false.
 * remember: 다음에도 이 단계로 시작 — 아주 느릴 때만 기억한다
 * (절전 모드처럼 잠깐 초당 30프레임으로 묶인 기기를 영영 낮은 화질로 두지 않게)
 */
export function lowerQuality(remember: boolean): boolean {
  if (level <= 0) return false;
  level--;
  if (!remember) return true;
  try {
    localStorage.setItem(KEY, String(level));
  } catch {
    /* 기억하지 못해도 이번 판에는 적용된다 */
  }
  return true;
}
