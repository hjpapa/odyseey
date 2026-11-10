/**
 * 소품 만들기 — Codex A4 의 진짜 모델이 있으면 그것을, 없으면 여기의 '임시 소품'을 쓴다.
 * (임시 소품은 A4 가 들어오면 자연스럽게 안 쓰이게 된다)
 */
import { Box3, CylinderGeometry, Group, Mesh, MeshBasicMaterial, type Object3D, Vector3 } from 'three';
import type { ModelOptions, PropId } from '../types/contracts';
import { getModel, hasRealModel } from '../core/models';
import { block, toonMaterial } from '../core/placeholders';

const cylCache = new Map<string, CylinderGeometry>();
function cyl(rt: number, rb: number, h: number, seg = 8): CylinderGeometry {
  const key = `${rt}|${rb}|${h}|${seg}`;
  let g = cylCache.get(key);
  if (!g) {
    g = new CylinderGeometry(rt, rb, h, seg);
    cylCache.set(key, g);
  }
  return g;
}
function cylMesh(rt: number, rb: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 8): Mesh {
  const m = new Mesh(cyl(rt, rb, h, seg), toonMaterial(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const glow = (color: string, opacity = 0.6) => new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

function group(...children: Object3D[]): Group {
  const g = new Group();
  g.add(...children);
  return g;
}

function palmTree(): Group {
  const g = new Group();
  for (let i = 0; i < 6; i++) g.add(block(0.42, 0.8, 0.42, i % 2 ? '#8d6e63' : '#7b5e52', i * i * 0.04, 0.4 + i * 0.75, 0));
  const top = new Group();
  top.position.set(1, 4.7, 0);
  for (let k = 0; k < 7; k++) {
    const arm = new Group();
    arm.rotation.y = (k / 7) * Math.PI * 2;
    const leaf = block(0.6, 0.12, 2.6, k % 2 ? '#2e9e44' : '#38b552', 0, 0, 1.15);
    leaf.rotation.x = 0.35;
    arm.add(leaf);
    top.add(arm);
  }
  top.add(block(0.3, 0.3, 0.3, '#6d4c2f', 0.25, -0.3, 0.1), block(0.3, 0.3, 0.3, '#6d4c2f', -0.2, -0.35, -0.15));
  g.add(top);
  return g;
}

const INTERIM: Partial<Record<PropId, () => Group>> = {
  palmTree,
  oliveTree: () => group(
    block(0.5, 2.2, 0.5, '#7b5e52', 0, 1.1, 0),
    block(0.35, 1, 0.35, '#7b5e52', 0.35, 2.2, 0.1),
    block(2.6, 1.4, 2.4, '#7d9b5a', 0, 3.1, 0),
    block(1.8, 1.1, 1.9, '#8fae6a', 0.6, 3.9, -0.3),
    block(1.6, 1, 1.6, '#6f8c4f', -0.8, 3.5, 0.5),
  ),
  pineTree: () => group(
    block(0.45, 1.6, 0.45, '#6d4c41', 0, 0.8, 0),
    block(2.6, 1.2, 2.6, '#2f7d4a', 0, 2.0, 0),
    block(1.9, 1.1, 1.9, '#358a52', 0, 3.0, 0),
    block(1.1, 1.0, 1.1, '#3c9a5c', 0, 3.9, 0),
  ),
  bush: () => group(block(1.2, 0.8, 1.1, '#4caf50', 0, 0.4, 0), block(0.8, 0.6, 0.8, '#5cbf60', 0.4, 0.75, 0.2)),
  flowerPatch: () => {
    const g = new Group();
    const colors = ['#ff7eb6', '#ffd93b', '#ffffff', '#b38cff', '#ff9f43'];
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4;
      const r = 0.3 + (i % 3) * 0.25;
      g.add(block(0.06, 0.4, 0.06, '#3f9b3f', Math.cos(a) * r, 0.2, Math.sin(a) * r));
      g.add(block(0.22, 0.14, 0.22, colors[i % colors.length], Math.cos(a) * r, 0.45, Math.sin(a) * r));
    }
    return g;
  },
  grassTuft: () => group(block(0.08, 0.5, 0.08, '#4caf50', 0, 0.25, 0), block(0.08, 0.4, 0.08, '#5cbf60', 0.15, 0.2, 0.05), block(0.08, 0.35, 0.08, '#43a047', -0.12, 0.18, -0.06)),
  rock: () => {
    const a = block(1.6, 1.0, 1.3, '#9aa3ad', 0, 0.5, 0);
    const b = block(0.9, 0.7, 0.9, '#8a939c', 0.5, 1.1, 0.2);
    b.rotation.y = 0.6;
    return group(a, b);
  },
  boulder: () => {
    const a = block(3.0, 2.2, 2.8, '#8e979f', 0, 1.1, 0);
    a.rotation.y = 0.3;
    const b = block(2.0, 1.4, 2.0, '#9ba4ac', 0.3, 2.6, -0.2);
    b.rotation.y = -0.4;
    return group(a, b);
  },
  log: () => {
    const m = cylMesh(0.26, 0.26, 1.7, '#9c6b3c', 0, 0.3, 0);
    m.rotation.z = Math.PI / 2;
    const end = cylMesh(0.2, 0.2, 1.72, '#d7a86e', 0, 0.3, 0);
    end.rotation.z = Math.PI / 2;
    return group(m, end);
  },
  chest: () => {
    const lid = new Group();
    lid.name = 'lid';
    lid.position.set(0, 0.6, -0.35);
    lid.add(block(1.0, 0.3, 0.72, '#a0522d', 0, 0.15, 0.35), block(1.04, 0.08, 0.1, '#f6c343', 0, 0.3, 0.7));
    return group(
      block(1.0, 0.6, 0.7, '#8b4513', 0, 0.3, 0),
      block(1.04, 0.1, 0.74, '#f6c343', 0, 0.55, 0),
      block(0.16, 0.2, 0.06, '#f6c343', 0, 0.5, 0.37),
      lid,
    );
  },
  coin: () => {
    const c = cylMesh(0.32, 0.32, 0.06, '#f6c343', 0, 0.6, 0, 12);
    c.rotation.x = Math.PI / 2;
    return group(c, block(0.08, 0.3, 0.07, '#6b8e23', 0, 0.6, 0.02));
  },
  owlShrine: () => {
    const owl = new Group();
    owl.name = 'owl';
    owl.position.y = 1.2;
    owl.add(
      block(0.55, 0.65, 0.5, '#8b6b3d', 0, 0.32, 0),
      block(0.6, 0.45, 0.5, '#9c7a48', 0, 0.82, 0),
      block(0.16, 0.16, 0.04, '#ffffff', 0.13, 0.86, 0.26),
      block(0.16, 0.16, 0.04, '#ffffff', -0.13, 0.86, 0.26),
      block(0.07, 0.07, 0.05, '#1b1b1b', 0.13, 0.86, 0.28),
      block(0.07, 0.07, 0.05, '#1b1b1b', -0.13, 0.86, 0.28),
      block(0.08, 0.12, 0.08, '#f6a623', 0, 0.72, 0.27),
      block(0.1, 0.18, 0.1, '#8b6b3d', 0.22, 1.1, 0),
      block(0.1, 0.18, 0.1, '#8b6b3d', -0.22, 1.1, 0),
    );
    const ring = new Mesh(cyl(1.1, 1.1, 0.05, 20), glow('#ffe066', 0.5));
    ring.name = 'glow';
    ring.position.y = 0.03;
    return group(block(1.1, 1.2, 1.1, '#c8c0b0', 0, 0.6, 0), block(1.3, 0.15, 1.3, '#b5ad9c', 0, 1.15, 0), owl, ring);
  },
  wisdomGate: () => {
    const pane = block(3.6, 3.5, 0.12, '#7fd3ff', 0, 1.8, 0);
    pane.material = glow('#7fd3ff', 0.45);
    pane.castShadow = false;
    pane.name = 'barrier';
    return group(
      block(0.9, 3.8, 0.9, '#c8c0b0', 2.25, 1.9, 0),
      block(0.9, 3.8, 0.9, '#c8c0b0', -2.25, 1.9, 0),
      block(5.6, 0.8, 1.1, '#b5ad9c', 0, 4.1, 0),
      block(0.7, 0.7, 0.2, '#f6c343', 0, 4.1, 0.56),
      block(0.18, 0.18, 0.05, '#1b1b1b', 0.13, 4.2, 0.67),
      block(0.18, 0.18, 0.05, '#1b1b1b', -0.13, 4.2, 0.67),
      pane,
    );
  },
  checkpointFlag: () => {
    const flag = block(1.0, 0.6, 0.06, '#b0bec5', 0.55, 2.5, 0);
    flag.name = 'flag';
    return group(block(0.5, 0.3, 0.5, '#9aa3ad', 0, 0.15, 0), block(0.12, 3, 0.12, '#795548', 0, 1.5, 0), flag);
  },
  campfire: () => {
    const g = new Group();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      g.add(block(0.32, 0.22, 0.32, '#8e979f', Math.cos(a) * 0.65, 0.11, Math.sin(a) * 0.65));
    }
    const l1 = block(1.0, 0.18, 0.18, '#6d4c2f', 0, 0.2, 0);
    l1.rotation.y = 0.7;
    const l2 = block(1.0, 0.18, 0.18, '#7b5a39', 0, 0.26, 0);
    l2.rotation.y = -0.7;
    const flame = new Group();
    flame.name = 'flame';
    const f1 = new Mesh(cyl(0.05, 0.32, 0.8, 6), glow('#ff8a1f', 0.9));
    f1.position.y = 0.65;
    const f2 = new Mesh(cyl(0.02, 0.18, 0.55, 6), glow('#ffe066', 0.95));
    f2.position.y = 0.6;
    flame.add(f1, f2);
    g.add(l1, l2, flame);
    return g;
  },
  caveEntrance: () => {
    const g = group(
      block(7, 4.5, 4, '#8e979f', 0, 2.25, -1),
      block(5, 2, 3.4, '#9ba4ac', 0.6, 5.2, -1.3),
      block(2.6, 3.0, 0.3, '#1c1c24', 0, 1.5, 1.02),
      block(3.2, 0.5, 0.5, '#7d858d', 0, 3.2, 1.1),
    );
    return g;
  },
  raft: () => {
    const g = new Group();
    for (let i = 0; i < 7; i++) {
      const log = cylMesh(0.22, 0.22, 3.8, i % 2 ? '#a0703f' : '#8b5e34', ((i * 37) % 5) * 0.06, 0.2, -1.32 + i * 0.44);
      log.rotation.z = Math.PI / 2;
      g.add(log);
    }
    const mast = new Group();
    mast.name = 'mast';
    mast.add(block(0.18, 3.4, 0.18, '#6d4c2f', 0, 1.9, 0), block(0.06, 2.1, 2.0, '#fff8e1', 0.1, 2.35, 0), block(0.07, 0.35, 2.02, '#e74c3c', 0.1, 2.7, 0));
    g.add(mast);
    return g;
  },
  crate: () => group(block(0.9, 0.9, 0.9, '#b07d48', 0, 0.45, 0), block(0.94, 0.12, 0.94, '#8a5a2b', 0, 0.85, 0), block(0.94, 0.12, 0.94, '#8a5a2b', 0, 0.06, 0)),
  barrel: () => group(cylMesh(0.42, 0.42, 1.0, '#a0703f', 0, 0.5, 0, 10), cylMesh(0.44, 0.44, 0.08, '#5d4037', 0, 0.25, 0, 10), cylMesh(0.44, 0.44, 0.08, '#5d4037', 0, 0.78, 0, 10)),
  sword: () => {
    const g = group(
      block(0.12, 1.0, 0.04, '#dfe6ee', 0, 0.62, 0),
      block(0.42, 0.08, 0.12, '#f6c343', 0, 0.1, 0),
      block(0.08, 0.28, 0.08, '#6d4c2f', 0, -0.06, 0),
    );
    g.rotation.x = Math.PI / 2;
    return group(g);
  },
  shield: () => {
    const face = cylMesh(0.48, 0.48, 0.08, '#d4a017', 0, 0, 0, 14);
    face.rotation.z = Math.PI / 2;
    const boss = cylMesh(0.14, 0.14, 0.12, '#8b5a2b', 0.03, 0, 0, 10);
    boss.rotation.z = Math.PI / 2;
    return group(face, boss);
  },
  signpost: () => group(block(0.16, 1.8, 0.16, '#795548', 0, 0.9, 0), block(1.2, 0.4, 0.08, '#a1887f', 0.35, 1.55, 0)),
  column: () => group(cylMesh(0.45, 0.45, 3.4, '#ece6da', 0, 1.9, 0, 10), block(1.1, 0.25, 1.1, '#d8d0c0', 0, 0.12, 0), block(1.1, 0.25, 1.1, '#d8d0c0', 0, 3.7, 0)),
  hut: () => {
    const roof = block(4.6, 0.5, 4.6, '#a1552c', 0, 3.0, 0);
    const roof2 = block(3.2, 0.5, 3.2, '#b5652f', 0, 3.45, 0);
    return group(block(4, 2.6, 4, '#e2c79b', 0, 1.3, 0), block(1.0, 1.8, 0.1, '#6d4c2f', 0, 0.9, 2.02), roof, roof2);
  },
};

/** 부딪히는 소품의 충돌 반지름 (모델과 상관없이 일정한 게임 감각) */
export const SOLID_RADIUS: Partial<Record<PropId, number>> = {
  palmTree: 0.45, oliveTree: 0.6, pineTree: 0.55, rock: 0.75, boulder: 1.7, chest: 0.6, owlShrine: 0.7,
  campfire: 0.75, caveEntrance: 3.2, crate: 0.55, barrel: 0.5, column: 0.55, hut: 2.4, signpost: 0.2,
  checkpointFlag: 0.15, temple: 4, house: 2.6, palace: 6, cliff: 3, brokenColumn: 0.55, amphora: 0.35, sundial: 0.7, clockTower: 1.6,
};

/** 앞뒤로 긴 소품(뗏목·배)의 긴 쪽을 +Z(진행 방향)로 맞춘다. 막 만든(회전 0) 모델에 쓴다 */
export function alignLengthToZ(obj: Object3D): void {
  const size = new Box3().setFromObject(obj).getSize(new Vector3());
  if (size.x > size.z * 1.05) obj.rotation.y += Math.PI / 2;
}

/** 메시를 높이로 나눈다 — 뗏목의 통나무(낮은 것)와 돛대·돛(높은 것) */
export function splitByHeight(obj: Object3D, line: number): { low: Mesh[]; tall: Mesh[] } {
  obj.updateMatrixWorld(true);
  const base = new Box3().setFromObject(obj).min.y;
  const low: Mesh[] = [];
  const tall: Mesh[] = [];
  const c = new Vector3();
  obj.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    new Box3().setFromObject(o).getCenter(c);
    (c.y - base > line ? tall : low).push(o);
  });
  return { low, tall };
}

export function makeProp(id: PropId, opts?: ModelOptions): Group {
  if (hasRealModel(id)) return getModel(id, opts);
  const build = INTERIM[id];
  if (build) {
    const g = build();
    g.userData = { ...g.userData, modelId: id, placeholder: false, interim: true };
    return g;
  }
  return getModel(id, opts);
}
