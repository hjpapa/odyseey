/**
 * 꾸미기 화면 — 올리브잎으로 투구·옷·망토·방패 색을 사고 입는다. (Codex C3 가 만든다)
 * 계약: contracts.ts 11장 OpenWardrobe / WardrobeOptions. 사고 입는 규칙은 src/game/shop.ts.
 * 아직 준비 중이라 타이틀 화면은 꾸미기 버튼을 숨긴다 (WARDROBE_READY).
 */
import type { OpenWardrobe } from '../types/contracts';

/** 화면을 다 만들면 true 로 바꾼다 — 그래야 타이틀에 '🎽 꾸미기' 버튼이 보인다 */
export const WARDROBE_READY: boolean = false;

export const openWardrobe: OpenWardrobe = async () => {};
