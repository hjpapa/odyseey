/**
 * 임시 블록 모델 — Codex A4 의 진짜 모델이 들어오기 전까지 쓰는 대역.
 * 사람형 리그 규약(HUMANOID_PARTS, ATTACH_POINTS)의 '참고 구현'이기도 합니다.
 */
import { BoxGeometry, Group, Mesh, MeshToonMaterial, Object3D } from 'three';
import {
  ATTACH_POINTS,
  CREATURE_IDS,
  CREATURE_PART_HINTS,
  HUMANOID_IDS,
  MODEL_HEIGHT_RANGE,
  type CreatureId,
  type ModelId,
  type ModelOptions,
} from '../types/contracts';
import { hashString } from './rng';

const unitBox = new BoxGeometry(1, 1, 1);
const materials = new Map<string, MeshToonMaterial>();

export function toonMaterial(color: string): MeshToonMaterial {
  let m = materials.get(color);
  if (!m) {
    m = new MeshToonMaterial({ color });
    materials.set(color, m);
  }
  return m;
}

export function block(
  w: number, h: number, d: number, color: string,
  x = 0, y = 0, z = 0,
): Mesh {
  const mesh = new Mesh(unitBox, toonMaterial(color));
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function joint(name: string, x: number, y: number, z: number): Group {
  const g = new Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
}

function attachPoint(name: (typeof ATTACH_POINTS)[number], x: number, y: number, z: number): Object3D {
  const o = new Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return o;
}

const PALETTE = ['#e74c3c', '#3b6fd8', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400', '#2c3e50'];
const SKINS = ['#f5cba7', '#e0ac69', '#c68642', '#8d5524'];

function colorFor(id: string, salt = 0): string {
  return PALETTE[(hashString(id) + salt) % PALETTE.length];
}

function heightFor(id: ModelId, fallback: number): number {
  const r = MODEL_HEIGHT_RANGE[id];
  return r ? (r[0] + r[1]) / 2 : fallback;
}

export interface HumanoidColors {
  skin: string;
  shirt: string;
  pants: string;
  hair: string;
}

/** 로블록스식 블록 사람 (키 height, 비율 다리 0.4 / 몸통 0.4 / 머리 0.2) */
export function blockHumanoid(c: HumanoidColors, height = 2): Group {
  const s = height / 2;
  const root = new Group();

  const legL = joint('legL', 0.2 * s, 0.8 * s, 0);
  legL.add(block(0.38 * s, 0.8 * s, 0.4 * s, c.pants, 0, -0.4 * s, 0));
  const legR = joint('legR', -0.2 * s, 0.8 * s, 0);
  legR.add(block(0.38 * s, 0.8 * s, 0.4 * s, c.pants, 0, -0.4 * s, 0));

  const torso = joint('torso', 0, 0.8 * s, 0);
  torso.add(block(0.8 * s, 0.8 * s, 0.42 * s, c.shirt, 0, 0.4 * s, 0));
  torso.add(attachPoint('back', 0, 0.65 * s, -0.22 * s));

  const makeArm = (name: 'armL' | 'armR', side: 1 | -1, hand: 'handL' | 'handR') => {
    const arm = joint(name, side * 0.6 * s, 1.55 * s, 0);
    arm.add(block(0.36 * s, 0.3 * s, 0.38 * s, c.shirt, 0, -0.1 * s, 0));
    arm.add(block(0.34 * s, 0.48 * s, 0.36 * s, c.skin, 0, -0.48 * s, 0));
    arm.add(attachPoint(hand, 0, -0.72 * s, 0.05 * s));
    return arm;
  };
  const armL = makeArm('armL', 1, 'handL');
  const armR = makeArm('armR', -1, 'handR');

  const head = joint('head', 0, 1.6 * s, 0);
  head.add(block(0.46 * s, 0.46 * s, 0.46 * s, c.skin, 0, 0.23 * s, 0));
  head.add(block(0.5 * s, 0.14 * s, 0.5 * s, c.hair, 0, 0.47 * s, -0.01 * s));
  head.add(block(0.08 * s, 0.08 * s, 0.02 * s, '#1b1b1b', 0.1 * s, 0.27 * s, 0.235 * s));
  head.add(block(0.08 * s, 0.08 * s, 0.02 * s, '#1b1b1b', -0.1 * s, 0.27 * s, 0.235 * s));
  head.add(block(0.16 * s, 0.03 * s, 0.02 * s, '#7b3f2a', 0, 0.13 * s, 0.235 * s));
  head.add(attachPoint('headTop', 0, 0.54 * s, 0));

  root.add(legL, legR, torso, armL, armR, head);
  root.userData = { height, radius: 0.45 * s };
  return root;
}

function placeholderCreature(id: CreatureId): Group {
  const h = heightFor(id, 1);
  const root = new Group();
  const color = colorFor(id);
  const parts = CREATURE_PART_HINTS[id];
  const body = joint('body', 0, h * 0.55, 0);
  body.add(block(h * 0.6, h * 0.45, h * 0.9, color));
  root.add(body);
  for (const p of parts) {
    if (p === 'body') continue;
    const idx = Number(p.replace(/\D/g, '')) || 0;
    if (p.startsWith('leg')) {
      const leg = joint(p, (idx % 2 ? 1 : -1) * h * 0.2, h * 0.35, (idx < 2 ? 1 : -1) * h * 0.3);
      leg.add(block(h * 0.12, h * 0.35, h * 0.12, color, 0, -h * 0.17, 0));
      root.add(leg);
    } else if (p.startsWith('wing')) {
      const side = p === 'wingL' ? 1 : -1;
      const wing = joint(p, side * h * 0.32, h * 0.6, 0);
      wing.add(block(h * 0.1, h * 0.3, h * 0.6, color, side * h * 0.05, 0, 0));
      root.add(wing);
    } else if (p.startsWith('neck')) {
      const a = (idx / 6) * Math.PI * 2;
      const neck = joint(p, Math.cos(a) * h * 0.15, h * 0.75, Math.sin(a) * h * 0.15);
      neck.add(block(h * 0.06, h * 0.35, h * 0.06, color, 0, h * 0.17, 0));
      root.add(neck);
    } else if (/^head\d$/.test(p)) {
      const a = (idx / 6) * Math.PI * 2;
      const head = joint(p, Math.cos(a) * h * 0.25, h * 1.0, Math.sin(a) * h * 0.25);
      head.add(block(h * 0.12, h * 0.1, h * 0.16, '#5d6d7e'));
      root.add(head);
    } else {
      const extra = joint(p, 0, h * 0.75, p === 'tail' ? -h * 0.5 : h * 0.5);
      extra.add(block(h * 0.3, h * 0.3, h * 0.3, color));
      root.add(extra);
    }
  }
  root.userData = { height: h, radius: h * 0.45 };
  return root;
}

function placeholderProp(id: ModelId): Group {
  const root = new Group();
  const h = 1;
  root.add(block(1, h, 1, colorFor(id, 3), 0, h / 2, 0));
  root.userData = { height: h, radius: 0.7 };
  return root;
}

/** 등록부에 없는 모델의 대역 */
export function placeholderModel(id: ModelId, opts: ModelOptions = {}): Group {
  if ((HUMANOID_IDS as readonly string[]).includes(id)) {
    const v = opts.variant ?? 0;
    return blockHumanoid(
      {
        skin: SKINS[(hashString(id) + v) % SKINS.length],
        shirt: id === 'odysseus' ? (opts.avatar?.tunicColor ?? '#3b6fd8') : colorFor(id, v),
        pants: '#5d4037',
        hair: '#3e2723',
      },
      heightFor(id, 2),
    );
  }
  if ((CREATURE_IDS as readonly string[]).includes(id)) {
    return placeholderCreature(id as CreatureId);
  }
  return placeholderProp(id);
}
