/**
 * 블록 섬 지형 — IslandLayout.terrain 으로 기둥(1.5m 칸)을 쌓는다.
 * - 이웃 칸 높이 차이를 0.5m 이하로 다듬어서 어디든 걸어서 오를 수 있다 (아이용)
 * - 중요한 자리(시작점·문·NPC…)는 평평하게
 */
import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, PlaneGeometry } from 'three';
import type { IslandLayout, TerrainPalette, XZ } from '../types/contracts';
import { toonMaterial } from '../core/placeholders';
import { BAKED_MATERIAL } from './merge';

export const SEA_FLOOR = -4;
const STEP = 0.5;
/** 지형 한 구역의 칸 수 */
const CHUNK_CELLS = 18;

export const PALETTES: Record<TerrainPalette, { sand: string; grass: string; rock: string; alt: string; seabed: string }> = {
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

  // 기둥 쌓기 — 보이는 면(윗면과 이웃보다 높은 옆면)만 만들고, 구역별 메시로 나눈다.
  // 이렇게 하면 삼각형이 크게 줄고, 화면·그림자 범위 밖 구역은 그리지 않는다.
  const pal = PALETTES[T.palette] ?? PALETTES.tropical;
  const colors = { sand: new Color(pal.sand), grass: new Color(pal.grass), rock: new Color(pal.rock), alt: new Color(pal.alt) };
  const rockLine = 1.5 + T.maxHeight * 0.72;
  const heightOf = (ix: number, iz: number) => {
    if (Math.abs(ix) > n || Math.abs(iz) > n) return SEA_FLOOR;
    const v = H[idx(ix, iz)];
    return v >= 0 ? v : SEA_FLOOR;
  };
  type Chunk = { pos: number[]; nor: number[]; col: number[]; idx: number[] };
  const chunks = new Map<string, Chunk>();
  const quad = (c: Chunk, pts: number[], nx: number, ny: number, nz: number, r: number, g: number, b: number) => {
    const base = c.pos.length / 3;
    c.pos.push(...pts);
    for (let i = 0; i < 4; i++) {
      c.nor.push(nx, ny, nz);
      c.col.push(r, g, b);
    }
    c.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const half = cell / 2;
  for (let ix = -n; ix <= n; ix++) {
    for (let iz = -n; iz <= n; iz++) {
      const k = idx(ix, iz);
      const h = H[k];
      if (!(h >= 0)) continue;
      const x = ix * cell;
      const z = iz * cell;
      const kind = beach[k] ? 'sand' : h >= rockLine ? 'rock' : hash2(ix, iz, T.seed + 9) < 0.1 ? 'alt' : 'grass';
      const v = 0.9 + hash2(Math.round(x * 7), Math.round(z * 7), 3) * 0.12;
      const r = colors[kind].r * v;
      const g = colors[kind].g * v;
      const b = colors[kind].b * v;
      const key = `${Math.floor(ix / CHUNK_CELLS)},${Math.floor(iz / CHUNK_CELLS)}`;
      let c = chunks.get(key);
      if (!c) chunks.set(key, (c = { pos: [], nor: [], col: [], idx: [] }));
      const x0 = x - half;
      const x1 = x + half;
      const z0 = z - half;
      const z1 = z + half;
      quad(c, [x0, h, z0, x0, h, z1, x1, h, z1, x1, h, z0], 0, 1, 0, r, g, b);
      let low = heightOf(ix + 1, iz);
      if (low < h) quad(c, [x1, h, z1, x1, low, z1, x1, low, z0, x1, h, z0], 1, 0, 0, r, g, b);
      low = heightOf(ix - 1, iz);
      if (low < h) quad(c, [x0, h, z0, x0, low, z0, x0, low, z1, x0, h, z1], -1, 0, 0, r, g, b);
      low = heightOf(ix, iz + 1);
      if (low < h) quad(c, [x0, h, z1, x0, low, z1, x1, low, z1, x1, h, z1], 0, 0, 1, r, g, b);
      low = heightOf(ix, iz - 1);
      if (low < h) quad(c, [x1, h, z0, x1, low, z0, x0, low, z0, x0, h, z0], 0, 0, -1, r, g, b);
    }
  }
  const group = new Group();
  for (const c of chunks.values()) {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(c.pos, 3));
    geo.setAttribute('normal', new Float32BufferAttribute(c.nor, 3));
    geo.setAttribute('color', new Float32BufferAttribute(c.col, 3));
    geo.setIndex(c.idx);
    const mesh = new Mesh(geo, BAKED_MATERIAL);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
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
