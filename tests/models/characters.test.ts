import { Box3, Mesh, MeshToonMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { getModel, hasRealModel } from '../../src/core/models';
import { HumanoidRig } from '../../src/play/rig';
import { CREATURE_IDS, DEFAULT_AVATAR, HELMET_IDS, HUMANOID_IDS } from '../../src/types/contracts';
import { countMeshes, validateModel } from '../helpers/validate';

describe('신화 캐릭터의 게임 연결', () => {
  it.each([...HUMANOID_IDS, ...CREATURE_IDS])('%s의 실제 크기, 원점, 관절과 메시 예산', id => {
    const g = getModel(id);
    expect(hasRealModel(id)).toBe(true);
    expect(g.userData.placeholder).toBe(false);
    expect(validateModel(id, g)).toEqual([]);
    const bounds = new Box3().setFromObject(g);
    expect(bounds.min.y).toBeCloseTo(0, 5);
    expect(bounds.max.y).toBeCloseTo(g.userData.height, 5);
    expect(g.scale.toArray()).toEqual([1, 1, 1]);
    expect(countMeshes(g)).toBeLessThanOrEqual((HUMANOID_IDS as readonly string[]).includes(id) ? 80 : 200);
    // SeaStage changes the public root scale. It must retain the intended size.
    g.scale.setScalar(3);
    expect(new Box3().setFromObject(g).max.y).toBeCloseTo(g.userData.height * 3, 5);
  });

  it('꾸미기 조합의 크기와 관절이 유지되고 장비가 비어 있어 중복 부착되지 않는다', () => {
    for (const helmet of HELMET_IDS) for (const capeColor of [null, '#792d36']) {
      const g = getModel('odysseus', { avatar: { ...DEFAULT_AVATAR, helmet, capeColor, tunicColor:'#325c78' } });
      expect(g.getObjectByName('headTop')!.children.length > 0).toBe(helmet !== 'none');
      expect(g.getObjectByName('back')!.children.length > 0).toBe(capeColor !== null);
      expect(g.getObjectByName('handR')!.children).toHaveLength(0);
      expect(g.getObjectByName('handL')!.children).toHaveLength(0);
      const bounds = new Box3().setFromObject(g);
      expect(bounds.min.y).toBeCloseTo(0, 5);
      expect(bounds.max.y).toBeCloseTo(g.userData.height, 5);
    }
  });

  it('전령의 지팡이가 휘두르기와 함께 움직이고 다른 인물의 자세를 바꾸지 않는다', () => {
    const a = getModel('hermes'); const b = getModel('hermes');
    const staffA = a.getObjectByName('caduceus')!;
    const staffB = b.getObjectByName('caduceus')!;
    const initial = staffA.getWorldPosition(new Vector3());
    const other = staffB.getWorldPosition(new Vector3());
    const rig = new HumanoidRig(a);
    rig.update(.1, { speed:0, grounded:true, swing:.1, combo:0 });
    expect(staffA.getWorldPosition(new Vector3()).distanceTo(initial)).toBeGreaterThan(.1);
    expect(staffB.getWorldPosition(new Vector3()).distanceTo(other)).toBe(0);
    for (const grounded of [true, false]) {
      rig.update(.1, { speed:1, grounded, swing:null, combo:0 });
      a.updateMatrixWorld(true);
      a.traverse(o => expect(o.matrixWorld.elements.every(Number.isFinite)).toBe(true));
    }
  });

  it('재질과 지오메트리는 공유하되 인물과 장비의 장면 노드는 독립적이다', () => {
    const a = getModel('calypso'); const b = getModel('calypso');
    const meshes: Mesh[] = [];
    a.traverse(o => { if (o instanceof Mesh) meshes.push(o); });
    const copies: Mesh[] = [];
    b.traverse(o => { if (o instanceof Mesh) copies.push(o); });
    meshes.forEach((m, i) => {
      expect(m).not.toBe(copies[i]);
      expect(m.geometry).toBe(copies[i].geometry);
      expect(m.material).toBe(copies[i].material);
      expect(m.material).toBeInstanceOf(MeshToonMaterial);
    });
  });
});
