/** 움직이지 않는 소품을 재질별로 합쳐서 그리기 횟수(draw call)를 줄인다 */
import { type BufferGeometry, Group, InstancedMesh, type Material, Mesh, type Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const KEEP = ['position', 'normal', 'uv'];

export function mergeStatic(root: Object3D): Group {
  root.updateMatrixWorld(true);
  const byMat = new Map<Material, BufferGeometry[]>();
  const noShadow = new Set<Material>();
  root.traverse((o) => {
    if (!(o instanceof Mesh) || o instanceof InstancedMesh || Array.isArray(o.material)) return;
    let g = o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (g.index) g = g.toNonIndexed();
    g.applyMatrix4(o.matrixWorld);
    const mat = o.material as Material;
    if (!o.castShadow) noShadow.add(mat);
    let list = byMat.get(mat);
    if (!list) byMat.set(mat, (list = []));
    list.push(g);
  });
  const out = new Group();
  for (const [mat, geos] of byMat) {
    const attrsSame = geos.every((g) => Object.keys(g.attributes).sort().join() === Object.keys(geos[0].attributes).sort().join());
    const merged = attrsSame ? mergeGeometries(geos, false) : null;
    if (!merged) continue;
    const mesh = new Mesh(merged, mat);
    mesh.castShadow = !noShadow.has(mat) && !mat.transparent;
    mesh.receiveShadow = true;
    out.add(mesh);
    geos.forEach((g) => g.dispose());
  }
  return out;
}
