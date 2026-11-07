import { Box3, BoxGeometry, CylinderGeometry, Group, Mesh, Object3D, type BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { material } from './palette';

const cube = new BoxGeometry(1, 1, 1);
const softCube = new RoundedBoxGeometry(1, 1, 1, 1, 0.10);
const skirtGeometry = new BoxGeometry(1, 1, 1);
const skirtPositions = skirtGeometry.attributes.position;
for (let i = 0; i < skirtPositions.count; i++) {
  const taper = skirtPositions.getY(i) > 0 ? .78 : 1;
  skirtPositions.setX(i, skirtPositions.getX(i) * taper);
  skirtPositions.setZ(i, skirtPositions.getZ(i) * taper);
}
skirtGeometry.computeVertexNormals();
const cylinders = new Map<number, BufferGeometry>();

export function part(parent: Object3D, name: string, x = 0, y = 0, z = 0): Group {
  const g = new Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export function box(parent: Object3D, color: string, w: number, h: number, d: number,
  x = 0, y = 0, z = 0, soft = true): Mesh {
  const m = new Mesh(soft ? softCube : cube, material(color));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function drape(parent: Object3D, color: string, w: number, h: number, d: number, y: number) {
  const m = new Mesh(skirtGeometry, material(color));
  m.scale.set(w, h, d); m.position.y = y;
  m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}

/** Cylinders face +Y; rotate X by PI/2 for shields and medallions. */
export function disc(parent: Object3D, color: string, radius: number, depth: number,
  x = 0, y = 0, z = 0, segments = 12): Mesh {
  let geo = cylinders.get(segments);
  if (!geo) { geo = new CylinderGeometry(1, 1, 1, segments); cylinders.set(segments, geo); }
  const m = new Mesh(geo, material(color));
  m.scale.set(radius, depth, radius);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Keep measurements honest, including headwear, with feet on Y=0. */
export function finish(root: Group, height: number, radius: number): Group {
  const bounds = new Box3().setFromObject(root);
  const scale = height / (bounds.max.y - bounds.min.y);
  // Keep the public root at unit scale: stages may set root.scale themselves.
  const assembly = new Group(); assembly.name = 'modelAssembly';
  for (const child of [...root.children]) { child.position.y -= bounds.min.y; assembly.add(child); }
  assembly.scale.setScalar(scale);
  root.add(assembly);
  root.userData = { height, radius: radius * scale, artStyle: 'aegean-myth' };
  return root;
}
