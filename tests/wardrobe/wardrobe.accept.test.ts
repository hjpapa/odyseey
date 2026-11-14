// [수용 테스트 — Codex C3 꾸미기 상점] npm run test:accept -- tests/wardrobe
import { describe, expect, it } from 'vitest';
import { Color, Mesh, type MeshToonMaterial } from 'three';
import { chapters, islands, shopItems } from '../../src/content';
import { getModel } from '../../src/core/models';
import { WARDROBE_READY, openWardrobe } from '../../src/ui/wardrobe';
import {
  CHAPTER_IDS, DEFAULT_AVATAR, HELMET_IDS, WARDROBE_SLOTS, type AvatarCustomization, type WardrobeSlot,
} from '../../src/types/contracts';

const HEX = /^#[0-9a-f]{6}$/i;
const defaultValue: Record<WardrobeSlot, string | null> = {
  helmet: DEFAULT_AVATAR.helmet,
  tunic: DEFAULT_AVATAR.tunicColor,
  cape: DEFAULT_AVATAR.capeColor,
  shield: DEFAULT_AVATAR.shieldColor,
};

/** 한 번 끝까지 놀면 적어도 이만큼은 모인다: 장 보상 + 보물상자 + 문제마다 1개 */
const EARNABLE =
  CHAPTER_IDS.reduce((n, id) => n + (chapters[id]?.reward.coins ?? 0), 0) +
  Object.values(islands).reduce((n, l) => n + (l?.chests.reduce((m, c) => m + c.coins, 0) ?? 0), 0) +
  CHAPTER_IDS.reduce((n, id) => n + (chapters[id]?.quizSlots.reduce((m, s) => m + (s.count ?? 1), 0) ?? 0), 0);

describe('꾸미기 상점 데이터 (data/shop.json)', () => {
  it('항목 id 가 겹치지 않고, 부위·이름·이모지·가격이 규칙에 맞다', () => {
    const ids = shopItems.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of shopItems) {
      expect(WARDROBE_SLOTS).toContain(item.slot);
      expect(item.id.startsWith(`${item.slot}-`)).toBe(true);
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.name.length).toBeLessThanOrEqual(10);
      expect(item.emoji.length).toBeGreaterThan(0);
      expect(Number.isInteger(item.price) && item.price >= 0 && item.price <= 300).toBe(true);
      if (item.slot === 'helmet') expect(HELMET_IDS).toContain(item.value);
      else if (item.slot === 'cape' && item.value === null) continue;
      else expect(item.value).toMatch(HEX);
    }
  });

  it('부위마다 4개 이상, 투구는 모든 종류, 망토는 "망토 없음"도 있다', () => {
    for (const slot of WARDROBE_SLOTS) expect(shopItems.filter((i) => i.slot === slot).length).toBeGreaterThanOrEqual(4);
    const helmets = shopItems.filter((i) => i.slot === 'helmet').map((i) => i.value);
    for (const h of HELMET_IDS) expect(helmets).toContain(h);
    expect(shopItems.some((i) => i.slot === 'cape' && i.value === null)).toBe(true);
  });

  it('처음 모습(DEFAULT_AVATAR)은 부위마다 가격 0 으로 들어 있다', () => {
    for (const slot of WARDROBE_SLOTS) {
      const item = shopItems.find((i) => i.slot === slot && (i.value ?? '').toLowerCase() === (defaultValue[slot] ?? '').toLowerCase());
      expect(item, slot).toBeDefined();
      expect(item?.price).toBe(0);
    }
  });

  it('값이 아이가 모을 수 있는 올리브잎에 맞다 — 1장 뒤에 하나는 살 수 있고, 끝까지 하면 모두 살 수 있다', () => {
    const paid = shopItems.filter((i) => i.price > 0);
    expect(paid.length).toBeGreaterThanOrEqual(12);
    expect(Math.min(...paid.map((i) => i.price))).toBeLessThanOrEqual(30);
    for (const slot of WARDROBE_SLOTS) expect(paid.some((i) => i.slot === slot && i.price <= 60)).toBe(true);
    const total = paid.reduce((n, i) => n + i.price, 0);
    expect(total).toBeLessThanOrEqual(EARNABLE);
    expect(total).toBeGreaterThanOrEqual(Math.round(EARNABLE * 0.35));
  });
});

describe('꾸미기 모델과 화면', () => {
  it('방패 모델이 avatar.shieldColor 로 칠해진다', () => {
    const avatar: AvatarCustomization = { ...DEFAULT_AVATAR, shieldColor: '#12ab34' };
    const shield = getModel('shield', { avatar });
    const want = new Color('#12ab34');
    let found = false;
    shield.traverse((o) => {
      if (o instanceof Mesh && (o.material as MeshToonMaterial).color?.equals(want)) found = true;
    });
    expect(found).toBe(true);
  });

  it('꾸미기 화면이 준비되어 타이틀에 버튼이 보인다', () => {
    expect(typeof openWardrobe).toBe('function');
    expect(WARDROBE_READY).toBe(true);
  });
});
