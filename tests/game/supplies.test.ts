import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { normalizeSave } from '../../src/game/save';
import { emptySupplies, useSupply } from '../../src/game/supplies';
import { Player } from '../../src/play/player';

describe('모험 가방', () => {
  it('예전 저장은 빈 가방으로 열고, 정상 개수만 이어서 쓴다', () => {
    expect(normalizeSave({ version: 1 })?.supplies).toEqual(emptySupplies());
    expect(normalizeSave({ version: 1, supplies: { honey: 2, owlCharm: -1 } })?.supplies).toEqual({ honey: 2, owlCharm: 0 });
    expect(normalizeSave({ version: 1, supplies: { honey: 0.5, owlCharm: 4 } })?.supplies).toEqual({ honey: 0, owlCharm: 4 });
  });

  it('꿀은 가득 찬 하트에 쓰이지 않고 부족한 하트만 채운다', () => {
    const bag = { honey: 2, owlCharm: 0 };
    const player = { hp: 5, maxHp: 5, guarded: false };
    useSupply(bag, 'honey', player);
    expect(bag.honey).toBe(2);
    player.hp = 4;
    useSupply(bag, 'honey', player);
    expect(player.hp).toBe(5);
    expect(bag.honey).toBe(1);
    player.hp = 1;
    useSupply(bag, 'honey', player);
    expect(player.hp).toBe(3);
    expect(bag.honey).toBe(0);
  });

  it('이미 보호 중이면 추가로 쓰지 않고, 실제 피해 한 번만 막는다', () => {
    const bag = { honey: 0, owlCharm: 2 };
    const player = {
      hp: 4, maxHp: 5, guarded: false, invuln: 1, rollT: -1, swingT: -1,
      body: { pos: new Vector3() }, knock: new Vector3(),
      audio: { sfx: vi.fn() }, onDamaged: vi.fn(), onGuard: vi.fn(),
    };
    const damage = Player.prototype.damage.bind(player as unknown as Player);
    useSupply(bag, 'owlCharm', player);
    useSupply(bag, 'owlCharm', player);
    expect(bag.owlCharm).toBe(1);
    expect(damage(1, new Vector3())).toBe(false);
    expect(player.guarded).toBe(true);
    player.invuln = 0;
    expect(damage(1, new Vector3())).toBe(false);
    expect(player.guarded).toBe(false);
    expect(player.hp).toBe(4);
    expect(player.onGuard).toHaveBeenCalledOnce();
    player.invuln = 0;
    expect(damage(1, new Vector3())).toBe(true);
    expect(player.hp).toBe(3);
  });
});
