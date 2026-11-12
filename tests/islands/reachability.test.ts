/**
 * 섬 도달 가능성 — 실제 엔진의 지형·소품·충돌로 섬을 만들고, 시작점에서 0.5m 격자로 걸어 본다.
 * 1) 문을 모두 열면 NPC·아이템·상자·신전·체크포인트·구역·보스 무대·적 무리에 모두 갈 수 있다
 * 2) 지혜의 문 하나를 닫으면 그 문 앞까지는 갈 수 있고, 무언가는 갈 수 없게 된다 (돌아가는 길이 없다)
 */
import { describe, expect, it } from 'vitest';
import { chapters, islands } from '../../src/content';
import { IslandWorld } from '../../src/world/island';
import { gateColliders } from '../../src/world/gates';
import { SOLID_RADIUS } from '../../src/world/props';
import { STEP_UP } from '../../src/play/body';
import { CHAPTER_IDS, type ChapterData, type IslandLayout, type XZ } from '../../src/types/contracts';

const PLAYER_R = 0.45;
const GRID = 0.5;

interface Target {
  label: string;
  pos: XZ;
  /** 이 거리 안의 걸을 수 있는 칸에 닿으면 도달 */
  range: number;
}
interface Circle {
  x: number;
  z: number;
  r: number;
}

function targetsOf(isl: IslandLayout, ch: ChapterData): Target[] {
  const t: Target[] = [];
  for (const n of isl.npcs) t.push({ label: `npc:${n.id}`, pos: n.pos, range: 3.4 });
  for (const c of isl.collectibles) t.push({ label: `item:${c.id}`, pos: c.pos, range: 1.4 });
  for (const c of isl.chests) t.push({ label: `chest:${c.id}`, pos: c.pos, range: 2.3 });
  for (const s of isl.shrines) t.push({ label: `shrine:${s.id}`, pos: s.pos, range: 2.7 });
  for (const c of isl.checkpoints) t.push({ label: `checkpoint:${c.id}`, pos: c.pos, range: 2.3 });
  for (const z of isl.zones) t.push({ label: `zone:${z.id}`, pos: z.center, range: Math.max(1, z.radius - 0.5) });
  for (const e of isl.enemies) t.push({ label: `enemies:${e.id}`, pos: e.pos, range: 2 + e.spread });
  for (const g of isl.gates.filter((x) => x.chapter === ch.id)) t.push({ label: `gate:${g.id}`, pos: g.pos, range: 3.5 });
  if (isl.boss) t.push({ label: `boss:${isl.boss.id}`, pos: isl.boss.arenaCenter, range: isl.boss.arenaRadius * 0.8 });
  return t;
}

/** 엔진이 섬 위에 따로 세우는 것들의 충돌체 (IslandStage 와 같은 값) */
function stageColliders(isl: IslandLayout): Circle[] {
  return [
    ...isl.npcs.map((n) => ({ x: n.pos[0], z: n.pos[1], r: 0.5 })),
    ...isl.chests.map((c) => ({ x: c.pos[0], z: c.pos[1], r: SOLID_RADIUS.chest ?? 0.6 })),
    ...isl.shrines.map((s) => ({ x: s.pos[0], z: s.pos[1], r: SOLID_RADIUS.owlShrine ?? 0.7 })),
    ...isl.checkpoints.map((c) => ({ x: c.pos[0], z: c.pos[1], r: SOLID_RADIUS.checkpointFlag ?? 0.15 })),
  ];
}

class Walker {
  readonly n: number;
  private base: Uint8Array;
  private height: Float32Array;

  constructor(world: IslandWorld, isl: IslandLayout) {
    this.n = Math.ceil((isl.terrain.radius + 2) / GRID);
    const W = 2 * this.n + 1;
    this.base = new Uint8Array(W * W);
    this.height = new Float32Array(W * W);
    const blockers: Circle[] = [...world.colliders.filter((c) => c.active), ...stageColliders(isl)];
    for (let ix = -this.n; ix <= this.n; ix++) {
      for (let iz = -this.n; iz <= this.n; iz++) {
        const x = ix * GRID;
        const z = iz * GRID;
        const k = this.idx(ix, iz);
        this.height[k] = world.ground(x, z);
        if (!world.terrain.isLand(x, z)) continue;
        this.base[k] = blockers.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + PLAYER_R) ? 0 : 1;
      }
    }
  }

  idx(ix: number, iz: number) {
    return (ix + this.n) * (2 * this.n + 1) + (iz + this.n);
  }

  /** 시작점에서 갈 수 있는 칸 (extra: 닫힌 문 막 등 추가 장애물) */
  flood(start: XZ, extra: Circle[]): Uint8Array {
    const W = 2 * this.n + 1;
    const open = this.base.slice();
    for (let ix = -this.n; ix <= this.n; ix++) {
      for (let iz = -this.n; iz <= this.n; iz++) {
        const k = this.idx(ix, iz);
        if (open[k] && extra.some((c) => Math.hypot(ix * GRID - c.x, iz * GRID - c.z) < c.r + PLAYER_R)) open[k] = 0;
      }
    }
    const seen = new Uint8Array(W * W);
    const queue: number[] = [];
    // 시작점 가까운 걸을 수 있는 칸에서 출발
    let best = -1;
    let bestD = Infinity;
    for (let ix = -this.n; ix <= this.n; ix++) {
      for (let iz = -this.n; iz <= this.n; iz++) {
        const d = Math.hypot(ix * GRID - start[0], iz * GRID - start[1]);
        if (d < 2 && d < bestD && open[this.idx(ix, iz)]) {
          bestD = d;
          best = this.idx(ix, iz);
        }
      }
    }
    if (best < 0) return seen;
    seen[best] = 1;
    queue.push(best);
    const ok = (ix: number, iz: number) => Math.abs(ix) <= this.n && Math.abs(iz) <= this.n && open[this.idx(ix, iz)] === 1;
    while (queue.length) {
      const k = queue.pop()!;
      const ix = Math.floor(k / W) - this.n;
      const iz = (k % W) - this.n;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const jx = ix + dx;
        const jz = iz + dz;
        if (!ok(jx, jz)) continue;
        if (dx && dz && (!ok(ix + dx, iz) || !ok(ix, iz + dz))) continue; // 모서리 끼어들기 금지
        const j = this.idx(jx, jz);
        if (seen[j] || Math.abs(this.height[j] - this.height[k]) > STEP_UP) continue;
        seen[j] = 1;
        queue.push(j);
      }
    }
    return seen;
  }

  reaches(seen: Uint8Array, t: Target): boolean {
    const r = Math.ceil(t.range / GRID);
    const cx = Math.round(t.pos[0] / GRID);
    const cz = Math.round(t.pos[1] / GRID);
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const ix = cx + dx;
        const iz = cz + dz;
        if (Math.abs(ix) > this.n || Math.abs(iz) > this.n) continue;
        if (Math.hypot(ix * GRID - t.pos[0], iz * GRID - t.pos[1]) > t.range) continue;
        if (seen[this.idx(ix, iz)]) return true;
      }
    }
    return false;
  }
}

const walkers = new Map<string, Walker>();
function walkerFor(isl: IslandLayout): Walker {
  let w = walkers.get(isl.id);
  if (!w) {
    w = new Walker(new IslandWorld(isl, 'day'), isl);
    walkers.set(isl.id, w);
  }
  return w;
}

const cases = CHAPTER_IDS.map((id) => chapters[id])
  .filter((c): c is ChapterData => !!c)
  .map((ch) => ({ ch, isl: islands[ch.island] }))
  .filter((x): x is { ch: ChapterData; isl: IslandLayout } => !!x.isl && x.isl.kind !== 'seaCourse');

describe('섬 도달 가능성', () => {
  it.each(cases.map((c) => [c.ch.id, c.isl.id, c] as const))('%s (%s): 문을 열면 모든 곳에 갈 수 있다', (_id, _isl, { ch, isl }) => {
    const w = walkerFor(isl);
    const pillars = isl.gates.filter((g) => g.chapter === ch.id).flatMap((g) => gateColliders(g.pos, g.rotY).filter((c) => !c.barrier));
    const seen = w.flood(isl.spawn, pillars);
    const unreachable = targetsOf(isl, ch).filter((t) => !w.reaches(seen, t)).map((t) => t.label);
    expect(unreachable, `${isl.id} 에서 갈 수 없는 곳`).toEqual([]);
  });

  it.each(cases.filter((c) => c.isl.gates.some((g) => g.chapter === c.ch.id)).map((c) => [c.ch.id, c.isl.id, c] as const))(
    '%s (%s): 지혜의 문은 닫으면 돌아갈 길이 없다',
    (_id, _isl, { ch, isl }) => {
      const w = walkerFor(isl);
      const gates = isl.gates.filter((g) => g.chapter === ch.id);
      const pillars = gates.flatMap((g) => gateColliders(g.pos, g.rotY).filter((c) => !c.barrier));
      const targets = targetsOf(isl, ch);
      const allOpen = w.flood(isl.spawn, pillars);
      const problems: string[] = [];
      for (const g of gates) {
        const closed = w.flood(isl.spawn, [...pillars, ...gateColliders(g.pos, g.rotY).filter((c) => c.barrier)]);
        if (!w.reaches(closed, { label: g.id, pos: g.pos, range: 3.5 })) problems.push(`${g.id}: 닫힌 문 앞까지 갈 수 없음`);
        const guarded = targets.filter((t) => t.label !== `gate:${g.id}` && w.reaches(allOpen, t) && !w.reaches(closed, t));
        if (guarded.length === 0) problems.push(`${g.id}: 닫아도 막히는 곳이 없음 (돌아가는 길이 있거나 뒤에 아무것도 없음)`);
      }
      expect(problems).toEqual([]);
    },
  );
});
