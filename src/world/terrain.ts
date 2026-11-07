/**
 * 블록 섬 지형 — IslandLayout.terrain 으로 기둥(1.5m 칸)을 쌓는다.
 * - 이웃 칸 높이 차이를 0.5m 이하로 다듬어서 어디든 걸어서 오를 수 있다 (아이용)
 * - 중요한 자리(시작점·문·NPC…)는 평평하게
 */
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, Mesh, PlaneGeometry, Quaternion, Vector3 } from 'three';
import type { IslandLayout, TerrainPalette, XZ } from '../types/contracts';
import { toonMaterial } from '../core/placeholders';

export const SEA_FLOOR = -4;
const STEP = 0.5;

const PALETTES: Record<TerrainPalette, { sand: string; grass: string; rock: string; alt: string; seabed: string }> = {
  tropical: { sand: '#f2d49b', grass: '#6cc24a', rock: '#9aa3ad', alt: '#5cb23f', seabed: '#e6c98c' },
  grass: { sand: '#e8d5a3', grass: '#7cc45a', rock: '#a3a9b0', alt: '#6ab04c', seabed: '#d8c59a' },
  rock: { sand: '#d9c9a3', grass: '#8aa37b', rock: '#8e949c', alt: '#7a8087', seabed: '#b9ab8c' },
  volcanic: { sand: '#6b5b52', grass: '#5d6b45', rock: '#4a4040', alt: '#3d3535', seabed: '#4d4440' },
  flower: { sand: '#f5dcb4', grass: '#8fd16a', rock: '#b0a8b9', alt: '#f2a7c8', seabed: '#e8cfa5' },
  shadow: { sand: '#5a5f73', grass: '#3f4a5c', rock: '#2f3542', alt: '#4b4f68', seabed: '#3a3e4f' },
  golden: { sand: '#f5d58a', grass: '#c9c25a', rock: '#c7a462', alt: '#e6b84d', seabed: '#e0c27a' },
  marble: { sand: '#e9e4da', grass: '#d8d2c4', rock: '#bfb8aa', alt: '#cfc8b8', seabed: '#d6d0c2' },
};

export interface Terrain {
  group: Group;
  cell: number;
  radius: number;
  /** 지면 높이 (바다면 SEA_FLOOR) */
  heightAt(x: number, z: number): number;
  isLand(x: number, z: number): boolean;
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function fbm(x: number, y: number, seed: number, octaves = 3): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * f, y * f, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

export function buildTerrain(layout: IslandLayout, flatten: { pos: XZ; r: number }[] = []): Terrain {
  const T = layout.terrain;
  const cell = T.radius > 90 ? 2 : 1.5;
  const R = T.radius;
  const n = Math.ceil(R / cell) + 1;
  const W = 2 * n + 1;
  const H = new Float32Array(W * W).fill(NaN);
  const beach = new Uint8Array(W * W);
  const idx = (ix: number, iz: number) => (ix + n) * W + (iz + n);
  const interior = layout.kind === 'interior';

  for (let ix = -n; ix <= n; ix++) {
    for (let iz = -n; iz <= n; iz++) {
      const x = ix * cell;
      const z = iz * cell;
      if (interior) {
        if (Math.abs(x) <= R && Math.abs(z) <= R) H[idx(ix, iz)] = 1;
        continue;
      }
      const d = Math.hypot(x, z);
      const a = Math.atan2(z, x);
      const edge = R * (0.9 + 0.1 * fbm(Math.cos(a) * 1.6 + 10, Math.sin(a) * 1.6 + 10, T.seed + 7, 2));
      if (d > edge) continue;
      const inland = (edge - d) / Math.max(1, T.beachWidth);
      if (inland < 1) {
        H[idx(ix, iz)] = 1;
        beach[idx(ix, iz)] = 1;
        continue;
      }
      const hill = 1 - Math.min(1, d / edge) ** 1.6;
      const big = fbm(x / 22 + 50, z / 22 + 50, T.seed, 3);
      const small = fbm(x / 7, z / 7, T.seed + 3, 2) - 0.5;
      const h = 1.5 + hill * T.maxHeight * (0.35 + 0.65 * big) + T.roughness * small * 3;
      H[idx(ix, iz)] = Math.max(1.5, Math.round(h / STEP) * STEP);
    }
  }

  // 중요한 자리는 평평하게
  for (const f of flatten) {
    const cx = Math.round(f.pos[0] / cell);
    const cz = Math.round(f.pos[1] / cell);
    const target = H[idx(cx, cz)];
    if (!(target >= 0)) continue;
    const rr = Math.ceil(f.r / cell);
    for (let dx = -rr; dx <= rr; dx++) {
      for (let dz = -rr; dz <= rr; dz++) {
        const ix = cx + dx;
        const iz = cz + dz;
        if (Math.abs(ix) > n || Math.abs(iz) > n || Math.hypot(dx, dz) > rr) continue;
        const k = idx(ix, iz);
        if (H[k] >= 0 && !beach[k]) H[k] = target;
      }
    }
  }

  // 이웃 칸 높이 차이 ≤ 0.5 (걸어서 오를 수 있게)
  for (let pass = 0; pass < 40; pass++) {
    let changed = false;
    for (let ix = -n; ix <= n; ix++) {
      for (let iz = -n; iz <= n; iz++) {
        const k = idx(ix, iz);
        if (!(H[k] >= 0)) continue;
        let lim = H[k];
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const jx = ix + dx;
          const jz = iz + dz;
          if (Math.abs(jx) > n || Math.abs(jz) > n) continue;
          const v = H[idx(jx, jz)];
          if (v >= 0 && v + STEP < lim) lim = v + STEP;
        }
        if (lim < H[k]) {
          H[k] = lim;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // 기둥 쌓기 (재질별 InstancedMesh)
  const pal = PALETTES[T.palette] ?? PALETTES.tropical;
  const kinds: Record<'sand' | 'grass' | 'rock' | 'alt', { x: number; z: number; h: number }[]> = { sand: [], grass: [], rock: [], alt: [] };
  const rockLine = 1.5 + T.maxHeight * 0.72;
  for (let ix = -n; ix <= n; ix++) {
    for (let iz = -n; iz <= n; iz++) {
      const k = idx(ix, iz);
      const h = H[k];
      if (!(h >= 0)) continue;
      const x = ix * cell;
      const z = iz * cell;
      const kind = beach[k] ? 'sand' : h >= rockLine ? 'rock' : hash2(ix, iz, T.seed + 9) < 0.1 ? 'alt' : 'grass';
      kinds[kind].push({ x, z, h });
    }
  }
  const group = new Group();
  const geo = new BoxGeometry(1, 1, 1);
  const m = new Matrix4();
  const q = new Quaternion();
  const tint = new Color();
  const p = new Vector3();
  const s = new Vector3();
  for (const kind of ['sand', 'grass', 'rock', 'alt'] as const) {
    const cells = kinds[kind];
    if (cells.length === 0) continue;
    const inst = new InstancedMesh(geo, toonMaterial(pal[kind]), cells.length);
    cells.forEach((c, i) => {
      p.set(c.x, (c.h + SEA_FLOOR) / 2, c.z);
      s.set(cell, c.h - SEA_FLOOR, cell);
      inst.setMatrixAt(i, m.compose(p, q, s));
      const v = 0.9 + hash2(Math.round(c.x * 7), Math.round(c.z * 7), 3) * 0.12;
      inst.setColorAt(i, tint.setRGB(v, v, v));
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    group.add(inst);
  }
  const seabed = new Mesh(new PlaneGeometry(900, 900), toonMaterial(pal.seabed));
  seabed.rotation.x = -Math.PI / 2;
  seabed.position.y = SEA_FLOOR + 0.01;
  group.add(seabed);

  const lookup = (x: number, z: number) => {
    const ix = Math.round(x / cell);
    const iz = Math.round(z / cell);
    if (Math.abs(ix) > n || Math.abs(iz) > n) return NaN;
    return H[idx(ix, iz)];
  };
  return {
    group,
    cell,
    radius: R,
    heightAt: (x, z) => {
      const v = lookup(x, z);
      return v >= 0 ? v : SEA_FLOOR;
    },
    isLand: (x, z) => lookup(x, z) >= 0,
  };
}
