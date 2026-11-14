/**
 * 꾸미기 상점 규칙 — 사기·입기 (DOM 없음, 테스트 쉬움).
 * 가격 0 인 항목은 처음부터 가진 것. 같은 부위는 하나만 입는다.
 */
import { HELMET_IDS, type AvatarCustomization, type HelmetId, type ShopItem, type WardrobeSlot } from '../types/contracts';

export function isOwned(item: ShopItem, owned: readonly string[]): boolean {
  return item.price === 0 || owned.includes(item.id);
}

/** 그 부위에 지금 입은 값 */
export function slotValue(avatar: AvatarCustomization, slot: WardrobeSlot): string | null {
  switch (slot) {
    case 'helmet': return avatar.helmet;
    case 'tunic': return avatar.tunicColor;
    case 'cape': return avatar.capeColor;
    case 'shield': return avatar.shieldColor;
  }
}

const same = (a: string | null, b: string | null) => (a === null || b === null ? a === b : a.toLowerCase() === b.toLowerCase());

export function isWorn(item: ShopItem, avatar: AvatarCustomization): boolean {
  return same(slotValue(avatar, item.slot), item.value);
}

/** 입은 모습 (값이 맞지 않으면 그대로) */
export function wear(avatar: AvatarCustomization, item: ShopItem): AvatarCustomization {
  switch (item.slot) {
    case 'helmet':
      return HELMET_IDS.includes(item.value as HelmetId) ? { ...avatar, helmet: item.value as HelmetId } : avatar;
    case 'tunic':
      return item.value ? { ...avatar, tunicColor: item.value } : avatar;
    case 'cape':
      return { ...avatar, capeColor: item.value };
    case 'shield':
      return item.value ? { ...avatar, shieldColor: item.value } : avatar;
  }
}

export type BuyResult = { ok: true; coins: number; owned: string[] } | { ok: false; reason: 'owned' | 'coins' };

export function buy(item: ShopItem, coins: number, owned: readonly string[]): BuyResult {
  if (isOwned(item, owned)) return { ok: false, reason: 'owned' };
  if (coins < item.price) return { ok: false, reason: 'coins' };
  return { ok: true, coins: coins - item.price, owned: [...owned, item.id] };
}
