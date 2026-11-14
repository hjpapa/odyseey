import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, type ShopItem } from '../../src/types/contracts';
import { buy, isOwned, isWorn, slotValue, wear } from '../../src/game/shop';

const laurel: ShopItem = { id: 'helmet-laurel', slot: 'helmet', value: 'laurel', name: '월계관', emoji: '🌿', price: 40 };
const noCape: ShopItem = { id: 'cape-none', slot: 'cape', value: null, name: '망토 없음', emoji: '🚫', price: 0 };
const green: ShopItem = { id: 'tunic-green', slot: 'tunic', value: '#2E9E4F', name: '초록 옷', emoji: '👕', price: 25 };

describe('꾸미기 상점 규칙', () => {
  it('가격 0 은 처음부터 가진 것, 산 것은 owned 에 들어 있다', () => {
    expect(isOwned(noCape, [])).toBe(true);
    expect(isOwned(laurel, [])).toBe(false);
    expect(isOwned(laurel, ['helmet-laurel'])).toBe(true);
  });

  it('올리브잎이 모자라면 못 사고, 사면 값만큼 줄고 owned 에 더해진다', () => {
    expect(buy(laurel, 10, [])).toEqual({ ok: false, reason: 'coins' });
    expect(buy(laurel, 50, ['helmet-laurel'])).toEqual({ ok: false, reason: 'owned' });
    expect(buy(laurel, 50, ['x'])).toEqual({ ok: true, coins: 10, owned: ['x', 'helmet-laurel'] });
  });

  it('입으면 그 부위만 바뀌고, 망토는 벗을 수도 있다', () => {
    const a = wear(DEFAULT_AVATAR, laurel);
    expect(a).toEqual({ ...DEFAULT_AVATAR, helmet: 'laurel' });
    expect(wear(a, noCape).capeColor).toBeNull();
    expect(slotValue(wear(a, green), 'tunic')).toBe('#2E9E4F');
    expect(isWorn(green, { ...DEFAULT_AVATAR, tunicColor: '#2e9e4f' })).toBe(true);
    expect(wear(DEFAULT_AVATAR, { ...laurel, value: 'crown' })).toBe(DEFAULT_AVATAR);
  });
});
