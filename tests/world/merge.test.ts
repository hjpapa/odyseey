import { describe, expect, it } from 'vitest';
import { BoxGeometry, Color, Group, Mesh, MeshBasicMaterial, MeshToonMaterial, Object3D } from 'three';
import { getModel } from '../../src/core/models';
import { HUMANOID_PARTS } from '../../src/types/contracts';
import { BAKED_MATERIAL, compactModel, isBakeable, mergeStatic } from '../../src/world/merge';
import { buildTerrain } from '../../src/world/terrain';
import { islands } from '../../src/content';

const box = new BoxGeometry(1, 1, 1);
const toon = (c: string) => new MeshToonMaterial({ color: c });
const meshes = (o: Object3D) => {
  const out: Mesh[] = [];
  o.traverse((c) => { if (c instanceof Mesh) out.push(c); });
  return out;
};

describe('모델 가볍게 합치기', () => {
  it('같은 관절의 단색 메시를 하나로 합치고, 색과 자리는 정점에 남긴다', () => {
    const joint = new Group();
    joint.name = 'armL';
    const a = new Mesh(box, toon('#ff0000'));
    a.position.x = 2;
    const b = new Mesh(box, toon('#0000ff'));
    joint.add(a, b);
    compactModel(joint);
    expect(joint.children).toHaveLength(1);
    const m = joint.children[0] as Mesh;
    expect(m.material).toBe(BAKED_MATERIAL);
    const pos = m.geometry.attributes.position;
    const col = m.geometry.attributes.color;
    expect(pos.count).toBe(72);
    const red = new Color('#ff0000');
    expect(col.getX(0)).toBeCloseTo(red.r);
    expect(col.getZ(0)).toBeCloseTo(red.b);
    expect(Math.max(...Array.from({ length: 36 }, (_, i) => pos.getX(i)))).toBeCloseTo(2.5);
  });

  it('이름 있는 메시·투명 재질은 건드리지 않는다', () => {
    const g = new Group();
    const named = new Mesh(box, toon('#111111'));
    named.name = 'lid';
    const glass = new Mesh(box, new MeshToonMaterial({ color: '#fff', transparent: true, opacity: 0.5 }));
    const basic = new Mesh(box, new MeshBasicMaterial({ color: '#fff' }));
    g.add(named, glass, basic, new Mesh(box, toon('#222222')));
    compactModel(g);
    expect(g.getObjectByName('lid')).toBe(named);
    expect(g.children).toContain(glass);
    expect(g.children).toContain(basic);
    expect(g.children).toHaveLength(4);
    expect(isBakeable(glass.material)).toBe(false);
  });

  it('사람 모델은 그리기 조각이 크게 줄어도 관절은 모두 남는다', () => {
    const before = meshes(getModel('hermes')).length;
    const model = compactModel(getModel('hermes'));
    expect(meshes(model).length).toBeLessThan(before / 2);
    for (const part of HUMANOID_PARTS) expect(model.getObjectByName(part), part).toBeTruthy();
  });

  it('거울상(음수 크기) 메시는 면 방향을 바로잡는다', () => {
    const g = new Group();
    const m = new Mesh(box, toon('#00ff00'));
    m.scale.x = -1;
    g.add(m, new Mesh(box, toon('#00ff00')));
    compactModel(g);
    const geo = (g.children[0] as Mesh).geometry;
    const p = geo.attributes.position;
    const n = geo.attributes.normal;
    // 앞쪽 36개(거울상) 삼각형의 꼭짓점 순서가 법선과 같은 방향이어야 한다
    for (let t = 0; t < 36; t += 3) {
      const ax = p.getX(t + 1) - p.getX(t); const ay = p.getY(t + 1) - p.getY(t); const az = p.getZ(t + 1) - p.getZ(t);
      const bx = p.getX(t + 2) - p.getX(t); const by = p.getY(t + 2) - p.getY(t); const bz = p.getZ(t + 2) - p.getZ(t);
      const cx = ay * bz - az * by; const cy = az * bx - ax * bz; const cz = ax * by - ay * bx;
      expect(cx * n.getX(t) + cy * n.getY(t) + cz * n.getZ(t)).toBeGreaterThan(0);
    }
  });
});

describe('움직이지 않는 소품 합치기', () => {
  it('구역이 다르면 나누고, 같은 구역의 단색 소품은 한 번에 그린다', () => {
    const root = new Group();
    for (const [x, c] of [[1, '#ff0000'], [2, '#00ff00'], [100, '#0000ff']] as const) {
      const m = new Mesh(box, toon(c));
      m.position.x = x;
      m.castShadow = true;
      root.add(m);
    }
    const out = mergeStatic(root, 36);
    expect(out.children).toHaveLength(2);
    expect(out.children.every((m) => (m as Mesh).material === BAKED_MATERIAL && (m as Mesh).castShadow)).toBe(true);
  });
});

describe('지형', () => {
  const layout = islands.ogygia!;
  const t = buildTerrain(layout);
  const land = meshes(t.group).filter((m) => m.material === BAKED_MATERIAL);

  it('구역으로 나뉘어 있고 정점 색을 가진다', () => {
    expect(land.length).toBeGreaterThan(4);
    for (const m of land) expect(m.geometry.attributes.color.count).toBe(m.geometry.attributes.position.count);
  });

  it('칸마다 윗면이 있고, 숨은 면을 빼서 상자 전체(칸당 12삼각형)보다 훨씬 적다', () => {
    let tris = 0; let tops = 0;
    for (const m of land) {
      const idx = m.geometry.index!;
      tris += idx.count / 3;
      const n = m.geometry.attributes.normal;
      for (let i = 0; i < n.count; i += 4) if (n.getY(i) === 1) tops++;
    }
    expect(tops).toBeGreaterThan(100);
    expect(tris).toBeLessThan(tops * 12 * 0.5);
    expect(tris).toBeGreaterThanOrEqual(tops * 2);
  });

  it('면의 꼭짓점 순서가 바깥을 향한다', () => {
    const g = land[0].geometry;
    const p = g.attributes.position; const n = g.attributes.normal; const idx = g.index!;
    for (let k = 0; k < Math.min(idx.count, 900); k += 3) {
      const [a, b, c] = [idx.getX(k), idx.getX(k + 1), idx.getX(k + 2)];
      const ux = p.getX(b) - p.getX(a); const uy = p.getY(b) - p.getY(a); const uz = p.getZ(b) - p.getZ(a);
      const vx = p.getX(c) - p.getX(a); const vy = p.getY(c) - p.getY(a); const vz = p.getZ(c) - p.getZ(a);
      const nx = uy * vz - uz * vy; const ny = uz * vx - ux * vz; const nz = ux * vy - uy * vx;
      expect(nx * n.getX(a) + ny * n.getY(a) + nz * n.getZ(a)).toBeGreaterThan(0);
    }
  });
});
