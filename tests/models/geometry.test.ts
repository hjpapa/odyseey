import { Box3, Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { modelRegistry } from '../../src/models/registry';
import { CREATURE_IDS, HUMANOID_IDS, PROP_IDS } from '../../src/types/contracts';

describe('모델 실제 치수와 관절 연결', () => {
  it('서 있는 모델은 발바닥이 0이고 높이 메타데이터가 실제 경계와 맞는다', () => {
    const equipment = ['sword', 'shield', 'bow', 'arrow', 'trident', 'caduceus', 'wand'];
    for (const id of [...HUMANOID_IDS, ...CREATURE_IDS, ...PROP_IDS]) {
      const model = modelRegistry[id]();
      const box = new Box3().setFromObject(model);
      if (!equipment.includes(id)) expect(box.min.y, id).toBeCloseTo(0, 5);
      expect(box.max.y - box.min.y, id).toBeCloseTo(model.userData.height, 5);
    }
  });
  it('어깨를 돌리면 손과 장비가 따라 움직이고 다른 인물은 바뀌지 않는다', () => {
    const a = modelRegistry.odysseus(), b = modelRegistry.odysseus();
    const before = a.getObjectByName('handR')!.getWorldPosition(new Vector3());
    a.getObjectByName('armR')!.rotation.x = .7;
    const after = a.getObjectByName('handR')!.getWorldPosition(new Vector3());
    expect(before.distanceTo(after)).toBeGreaterThan(.2);
    expect(b.getObjectByName('armR')!.rotation.x).toBe(0);
    expect(a.getObjectByName('handR')!.getObjectByName('sword')).toBeDefined();
  });
  it('같은 색의 재질은 공유하되 메시와 관절은 새로 만든다', () => {
    const a = modelRegistry.sheep(), b = modelRegistry.sheep();
    const meshes = (g: typeof a) => { const out: Mesh[] = []; g.traverse(o => { if (o instanceof Mesh) out.push(o); }); return out; };
    const am = meshes(a), bm = meshes(b);
    expect(am[0]).not.toBe(bm[0]);
    expect(am[0].material).toBe(bm[0].material);
  });
});
