import { describe, expect, it } from 'vitest';
import { MAX_ATTACKERS, mayAttack } from '../../src/play/enemy';

const e = (attacking: boolean, alive = true) => ({ attacking, alive });

describe('적의 공격 차례', () => {
  it('공격 중인 적이 적으면 공격할 수 있다', () => {
    expect(mayAttack([e(false), e(false), e(false)])).toBe(true);
    expect(mayAttack([e(true), e(false)])).toBe(true);
  });

  it(`이미 ${MAX_ATTACKERS}명이 공격 중이면 기다린다`, () => {
    expect(mayAttack([e(true), e(true), e(false)])).toBe(false);
  });

  it('쓰러진 적은 세지 않는다', () => {
    expect(mayAttack([e(true, false), e(true, false), e(true)])).toBe(true);
  });
});
