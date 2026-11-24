export const SUPPLY_IDS = ['honey', 'owlCharm'] as const;
export type SupplyId = typeof SUPPLY_IDS[number];
export type Supplies = Record<SupplyId, number>;

export const SUPPLY_INFO = {
  honey: { icon: '🍯', name: '꿀 단지', help: '하트를 2개까지 채워요.' },
  owlCharm: { icon: '🦉', name: '아테나 부엉이', help: '이 장에서 다음 공격을 한 번 막아요.' },
} satisfies Record<SupplyId, { icon: string; name: string; help: string }>;

export function emptySupplies(): Supplies {
  return { honey: 0, owlCharm: 0 };
}

export function normalizeSupplies(raw: unknown): Supplies {
  const supplies = emptySupplies();
  if (!raw || typeof raw !== 'object') return supplies;
  const values = raw as Partial<Supplies>;
  for (const id of SUPPLY_IDS) {
    const value = values[id];
    if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) supplies[id] = value;
  }
  return supplies;
}

/** 첫 상자에서 회복을, 다음 상자에서 보호를 배운다. */
export function chestSupply(index: number): SupplyId {
  return index % 2 === 0 ? 'honey' : 'owlCharm';
}

interface SupplyTarget {
  hp: number;
  maxHp: number;
  guarded: boolean;
}

export function useSupply(supplies: Supplies, id: SupplyId, target: SupplyTarget): string {
  if (supplies[id] <= 0) return '이 물건은 보물상자에서 찾아요.';
  if (id === 'honey') {
    if (target.hp >= target.maxHp) return '하트가 가득 차 있어요.';
    if (target.hp <= 0) return '일어난 뒤에 쓸 수 있어요.';
    const restored = Math.min(2, target.maxHp - target.hp);
    target.hp += restored;
    supplies[id]--;
    return '하트 ' + restored + '개를 채웠어요!';
  }
  if (target.guarded) return '부엉이가 이미 지켜주고 있어요.';
  target.guarded = true;
  supplies[id]--;
  return '다음 공격을 부엉이가 한 번 막아 줘요!';
}
