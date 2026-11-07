// [수용 테스트 — Codex A4] npm run test:accept -- tests/models
import { Mesh, MeshBasicMaterial, MeshToonMaterial, type Group } from 'three';
import { describe, expect, it } from 'vitest';
import { modelRegistry } from '../../src/models/registry';
import { DEFAULT_AVATAR, HELMET_IDS, HUMANOID_IDS, type ModelId } from '../../src/types/contracts';
import { MODEL_IDS, countMeshes, has } from '../helpers/validate';

const build = (id: ModelId, opts?: Parameters<NonNullable<(typeof modelRegistry)[ModelId]>>[0]) => modelRegistry[id]!(opts);
const colorsOf = (g: Group) => {
  const set = new Set<string>();
  g.traverse((o) => {
    if (o instanceof Mesh && 'color' in o.material) set.add((o.material as MeshToonMaterial).color.getHexString());
  });
  return [...set].sort().join(',');
};

describe('A4 블록 모델', () => {
  it('ModelId 전부 등록되어 있다', () => {
    expect(MODEL_IDS.filter((id) => typeof modelRegistry[id] !== 'function')).toEqual([]);
  });

  it('메시 수 제한 (사람형 80, 그 외 200)', () => {
    for (const id of MODEL_IDS) {
      if (!modelRegistry[id]) continue;
      const n = countMeshes(build(id));
      expect(n, `${id}: 메시 ${n}개`).toBeLessThanOrEqual(has(HUMANOID_IDS, id) ? 80 : 200);
      expect(n, `${id}: 메시가 없음`).toBeGreaterThan(0);
    }
  });

  it('재질은 MeshToonMaterial (빛나는 효과만 MeshBasicMaterial)', () => {
    for (const id of MODEL_IDS) {
      if (!modelRegistry[id]) continue;
      build(id).traverse((o) => {
        if (o instanceof Mesh) {
          const ok = o.material instanceof MeshToonMaterial || o.material instanceof MeshBasicMaterial;
          expect(ok, `${id}: ${o.material.type}`).toBe(true);
        }
      });
    }
  });

  it('부하·구혼자·병사·연꽃족은 variant 0~3 의 색이 서로 다르다', () => {
    for (const id of ['crewman', 'suitor', 'greekSoldier', 'lotusEater'] as const) {
      if (!modelRegistry[id]) continue;
      const looks = new Set([0, 1, 2, 3].map((variant) => colorsOf(build(id, { variant }))));
      expect(looks.size, id).toBe(4);
    }
  });

  it('오디세우스 꾸미기: 투구는 headTop 아래, 망토는 back 아래', () => {
    if (!modelRegistry.odysseus) return;
    for (const helmet of HELMET_IDS) {
      const g = build('odysseus', { avatar: { ...DEFAULT_AVATAR, helmet } });
      const n = g.getObjectByName('headTop')!.children.length;
      if (helmet === 'none') expect(n, 'helmet none').toBe(0);
      else expect(n, `helmet ${helmet}`).toBeGreaterThan(0);
    }
    const noCape = build('odysseus', { avatar: { ...DEFAULT_AVATAR, capeColor: null } });
    const cape = build('odysseus', { avatar: { ...DEFAULT_AVATAR, capeColor: '#ff0000' } });
    expect(noCape.getObjectByName('back')!.children.length).toBe(0);
    expect(cape.getObjectByName('back')!.children.length).toBeGreaterThan(0);
  });
});
