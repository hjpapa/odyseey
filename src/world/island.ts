/**
 * 섬 하나의 3D 세계: 지형·바다·하늘·소품·충돌.
 * 움직이는 것(사람·적·문·상자)은 play/ 쪽에서 얹는다.
 */
import { Group, Scene, type Object3D, type Vector3 } from 'three';
import type { IslandLayout, PropId, XZ } from '../types/contracts';
import { createRng } from '../core/rng';
import { createEnvironment, type Environment, type Mood } from './environment';
import { buildTerrain, type Terrain } from './terrain';
import { makeProp, SOLID_RADIUS } from './props';
import { mergeStatic } from './merge';

export interface Collider {
  x: number;
  z: number;
  r: number;
  active: boolean;
  tag?: string;
}

/**
 * 모델이 충돌 기둥보다 작아 보이면 그만큼 키운다 (최대 2배).
 * 그래야 '보이지 않는 벽' 없이, 보이는 만큼 막힌다 — 예: 비밀 숲을 둘러싼 바위.
 */
function fitToCollider(obj: Object3D, collider: number): number {
  const r = obj.userData.radius;
  if (typeof r !== 'number' || r <= 0 || r >= collider * 0.9) return 1;
  return Math.min(2, collider / r);
}

export class IslandWorld {
  readonly scene = new Scene();
  readonly env: Environment;
  readonly terrain: Terrain;
  readonly colliders: Collider[] = [];
  private keyPoints: XZ[] = [];

  constructor(readonly layout: IslandLayout, mood: Mood) {
    const L = layout;
    const flatten: { pos: XZ; r: number }[] = [
      { pos: L.spawn, r: 3 },
      ...L.checkpoints.map((c) => ({ pos: c.pos, r: 2 })),
      ...L.gates.map((g) => ({ pos: g.pos, r: 4 })),
      ...L.shrines.map((s) => ({ pos: s.pos, r: 2.5 })),
      ...L.chests.map((c) => ({ pos: c.pos, r: 1.5 })),
      ...L.npcs.map((n) => ({ pos: n.pos, r: 2.5 })),
      ...L.zones.map((z) => ({ pos: z.center, r: Math.min(4, z.radius * 0.4) })),
    ];
    if (L.boss) flatten.push({ pos: L.boss.arenaCenter, r: L.boss.arenaRadius * 0.8 });
    this.keyPoints = flatten.map((f) => f.pos);
    this.terrain = buildTerrain(L, flatten);
    this.scene.add(this.terrain.group);
    this.env = createEnvironment(this.scene, mood);

    const statics = new Group();
    for (const p of L.props) {
      const obj = this.placeProp(p.model, p.pos, p.rotY ?? 0, p.scale ?? 1, statics);
      obj.userData.layoutProp = true;
    }
    if (L.kind === 'island') this.scatterDecorations(statics);
    this.scene.add(mergeStatic(statics));
  }

  ground(x: number, z: number): number {
    return this.terrain.heightAt(x, z);
  }

  /** 소품을 지면에 놓고 (필요하면) 충돌 기둥을 만든다 */
  placeProp(id: PropId, pos: XZ, rotY = 0, scale = 1, parent: Object3D = this.scene): Group {
    const obj = makeProp(id);
    obj.position.set(pos[0], this.ground(pos[0], pos[1]), pos[1]);
    obj.rotation.y = rotY;
    const r = SOLID_RADIUS[id];
    obj.scale.setScalar(scale * (r ? fitToCollider(obj, r) : 1));
    parent.add(obj);
    if (r) this.addCollider(pos[0], pos[1], r * scale, id);
    return obj;
  }

  addCollider(x: number, z: number, r: number, tag?: string): Collider {
    const c: Collider = { x, z, r, active: true, tag };
    this.colliders.push(c);
    return c;
  }

  /** 원기둥 충돌체 밖으로 밀어낸다 (XZ 평면) */
  resolve(pos: Vector3, radius: number): boolean {
    let hit = false;
    for (const c of this.colliders) {
      if (!c.active) continue;
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const min = c.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.0001;
      pos.x = c.x + (dx / d) * min;
      pos.z = c.z + (dz / d) * min;
      hit = true;
    }
    return hit;
  }

  update(t: number, focus: Vector3) {
    this.env.follow(focus);
    this.env.update(t);
  }

  private scatterDecorations(parent: Object3D) {
    const L = this.layout;
    const rng = createRng(L.terrain.seed + 77);
    const R = L.terrain.radius * 0.85;
    const count = Math.round(L.terrain.radius * 0.9);
    const avoid: XZ[] = [...this.keyPoints, ...L.props.map((p) => p.pos), ...L.collectibles.map((c) => c.pos)];
    const flowery = L.terrain.palette === 'flower' || L.terrain.palette === 'tropical';
    let placed = 0;
    for (let tries = 0; tries < count * 6 && placed < count; tries++) {
      const a = rng.next() * Math.PI * 2;
      const r = Math.sqrt(rng.next()) * R;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (this.ground(x, z) < 1.5) continue;
      if (avoid.some((p) => Math.hypot(p[0] - x, p[1] - z) < 3.5)) continue;
      const roll = rng.next();
      const id: PropId = roll < 0.4 ? 'grassTuft' : roll < (flowery ? 0.7 : 0.85) ? 'bush' : 'flowerPatch';
      this.placeProp(id, [x, z], rng.next() * Math.PI * 2, 0.8 + rng.next() * 0.5, parent);
      placed++;
    }
  }
}
