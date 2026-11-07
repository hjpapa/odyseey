import { describe, expect, it } from 'vitest';
import { createRng, hashString } from '../src/core/rng';

describe('rng', () => {
  it('같은 seed 는 같은 수열', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('int 는 범위 안', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it('shuffle 은 원본을 바꾸지 않는 순열', () => {
    const src = [1, 2, 3, 4, 5];
    const out = createRng(1).shuffle(src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual(src);
  });

  it('hashString 은 결정적', () => {
    expect(hashString('odyssey')).toBe(hashString('odyssey'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});
