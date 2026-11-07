import { Box3, BoxGeometry, CylinderGeometry, Group, Mesh, Object3D, Vector3 } from 'three';
import { glow, palette as P, toon } from './palette';

const cube = new BoxGeometry(1, 1, 1);
const column = new CylinderGeometry(.5, .5, 1, 8);
export function block(parent: Object3D, size: [number, number, number], pos: [number, number, number], color: string, luminous = false): Mesh {
  const mesh = new Mesh(cube, luminous ? glow(color) : toon(color));
  mesh.scale.set(...size); mesh.position.set(...pos);
  mesh.castShadow = !luminous; mesh.receiveShadow = !luminous; parent.add(mesh);
  return mesh;
}
export function cylinder(parent: Object3D, radius: number, height: number, pos: [number, number, number], color: string): Mesh {
  const mesh = new Mesh(column, toon(color));
  mesh.scale.set(radius * 2, height, radius * 2); mesh.position.set(...pos);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export function joint(parent: Object3D, name: string, x = 0, y = 0, z = 0): Group {
  const group = new Group(); group.name = name; group.position.set(x, y, z); parent.add(group); return group;
}
export function face(parent: Object3D, y: number, z: number, width = .6, cyclops = false): void {
  for (const x of cyclops ? [0] : [-width * .23, width * .23]) {
    block(parent, [cyclops ? .23 : .12, cyclops ? .22 : .14, .035], [x, y, z], P.white);
    block(parent, [.055, .07, .025], [x, y, z + .024], P.ink);
  }
  block(parent, [.15, .035, .025], [0, y - .17, z + .005], P.hair);
  for (const x of [-width * .35, width * .35]) block(parent, [.09, .04, .02], [x, y - .11, z], P.rose);
}
/** Wrap the rig so the returned root stays at the soles, with truthful bounds. */
export function finish(content: Group, name: string, targetHeight?: number): Group {
  content.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(content);
  const factor = targetHeight ? targetHeight / (bounds.max.y - bounds.min.y) : 1;
  content.scale.multiplyScalar(factor);
  content.position.y -= bounds.min.y * factor;
  const root = new Group(); root.name = name; root.add(content); root.updateMatrixWorld(true);
  const actual = new Box3().setFromObject(root), size = actual.getSize(new Vector3());
  root.userData = { height: size.y, radius: Math.max(size.x, size.z) / 2 };
  return root;
}
