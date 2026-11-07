/**
 * [Codex A3] 효과음 프리셋 — SFX_IDS 전부 채우기.
 * 값은 ZzFX 파라미터 배열 (https://killedbyapixel.github.io/ZzFX/ 에서 만들고 복사).
 */
import type { SfxId } from '../types/contracts';

export type ZzfxParams = (number | undefined)[];

export const sfxPresets: Partial<Record<SfxId, ZzfxParams>> = {};
