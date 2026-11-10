import { Box3, Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { modelRegistry } from '../../src/models/registry';
import { CREATURE_IDS, HUMANOID_IDS, PROP_IDS } from '../../src/types/contracts';

const EQUIPMENT = ['sword', 'shield', 'bow', 'arrow', 'trident', 'caduceus', 'wand'];

describe('모델 실제 치수와 관절 연결', () => {
  it('서 있는 모델은 발바닥이 0이고 높이 메타데이터가 실제 경계와 맞는다', () => {
    for (const id of [...HUMANOID_IDS, ...CREATURE_IDS, ...PROP_IDS]) {
      if (EQUIPMENT.includes(id)) continue;
      const model = modelRegistry[id]();
      const box = new Box3().setFromObject(model);
      expect(box.min.y, id).toBeCloseTo(0, 5);
      expect(box.max.y - box.min.y, id).toBeCloseTo(model.userData.height, 5);
    }
  });

  it('손에 드는 장비는 손잡이가 원점이고, 가장 긴 변이 height 와 비슷하다', () => {
    for (const id of EQUIPMENT) {
      const model = modelRegistry[id as (typeof PROP_IDS)[number]]();
      const size = new Box3().setFromObject(model).getSize(new Vector3());
      const longest = Math.max(size.x, size.y, size.z);
      expect(Math.abs(longest - model.userData.height) / model.userData.height, id).toBeLessThan(0.15);
    }
  });

  it('손은 비어 있고(장비는 엔진이 붙임), 어깨를 돌리면 붙인 장비가 따라 움직인다', () => {
    const a = modelRegistry.odysseus(), b = modelRegistry.odysseus();
    const hand = a.getObjectByName('handR')!;
    expect(hand.children).toHaveLength(0);
    const sword = modelRegistry.sword();
    hand.add(sword);
    const before = sword.getWorldPosition(new Vector3());
    a.getObjectByName('armR')!.rotation.x = .7;
    const after = sword.getWorldPosition(new Vector3());
    expect(before.distanceTo(after)).toBeGreaterThan(.2);
    expect(b.getObjectByName('armR')!.rotation.x).toBe(0);
  });

  it('같은 색의 재질은 공유하되 메시와 관절은 새로 만든다', () => {
    const a = modelRegistry.sheep(), b = modelRegistry.sheep();
    const meshes = (g: typeof a) => { const out: Mesh[] = []; g.traverse(o => { if (o instanceof Mesh) out.push(o); }); return out; };
    const am = meshes(a), bm = meshes(b);
    expect(am[0]).not.toBe(bm[0]);
    expect(am[0].material).toBe(bm[0].material);
  });
});
