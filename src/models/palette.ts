/** Shared, texture-free materials for the Aegean character collection. */
import { MeshToonMaterial } from 'three';

export const P = {
  linen: '#f2e4c4', ivory: '#fff4da', bronze: '#ae713c', gold: '#e2b85d',
  darkGold: '#80532b', leather: '#694533', sole: '#43332b', ink: '#292e38',
  skin: '#dca778', blush: '#c17c59', hair: '#49352f', gray: '#d9d6c9',
  blue: '#376a93', sea: '#398c8a', red: '#9f4844', plum: '#785570',
  olive: '#6e8050', wood: '#866045', white: '#fffaf0',
} as const;

const cache = new Map<string, MeshToonMaterial>();
export function material(color: string): MeshToonMaterial {
  const key = color.toLowerCase();
  let result = cache.get(key);
  if (!result) {
    result = new MeshToonMaterial({ color });
    cache.set(key, result);
  }
  return result;
}
