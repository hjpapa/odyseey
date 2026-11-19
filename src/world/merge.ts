/**
 * 그리기 횟수(draw call)를 줄이는 도구.
 * - 단색 툰 재질 메시들은 '정점 색'으로 구워 한 번에 그린다 (모습은 같다)
 * - 움직이지 않는 소품은 구역별로 합쳐, 화면·그림자 범위 밖 구역은 아예 그리지 않게 한다
 */
import {
  BufferAttribute, type BufferGeometry, DirectionalLight, FrontSide, Group, InstancedMesh, Line, type Material, type Matrix4, Mesh,
  MeshToonMaterial, type Object3D, Points, type Scene, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const KEEP = ['position', 'normal', 'uv'];

/** 구운 메시가 함께 쓰는 재질 — 색은 정점마다 들어 있다 */
export const BAKED_MATERIAL = new MeshToonMaterial({ color: '#ffffff', vertexColors: true });

/** 정점 색으로 바꿔도 모습이 그대로인 재질인가 */
export function isBakeable(m: Material | Material[]): m is MeshToonMaterial {
  return m instanceof MeshToonMaterial && m !== BAKED_MATERIAL && !m.vertexColors && !m.transparent && m.opacity === 1
    && !m.map && !m.gradientMap && !m.alphaMap && m.side === FrontSide && m.emissive.getHex() === 0;
}

/** 면 방향이 뒤집히는 변환(거울상)이면 삼각형 꼭짓점 순서를 바꿔 준다 */
function fixMirror(g: BufferGeometry, matrix: Matrix4) {
  if (matrix.determinant() >= 0) return;
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name];
    const n = a.itemSize;
    const arr = a.array;
    for (let t = 0; t + 2 < a.count; t += 3) {
      for (let c = 0; c < n; c++) {
        const i = (t + 1) * n + c;
        const j = (t + 2) * n + c;
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
    }
  }
}

/** 메시 하나를 (위치·법선·색)만 가진 구운 조각으로 */
function bakedPart(mesh: Mesh, matrix: Matrix4): BufferGeometry {
  let g = mesh.geometry.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (g.index) g = g.toNonIndexed();
  g.applyMatrix4(matrix);
  fixMirror(g, matrix);
  const { r, g: green, b } = (mesh.material as MeshToonMaterial).color;
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = r;
    colors[i * 3 + 1] = green;
    colors[i * 3 + 2] = b;
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

/**
 * 모델을 가볍게 — 같은 관절에 붙은 이름 없는 단색 메시들을 하나로 합친다.
 * 관절(이름 있는 그룹)과 이름 있는 메시는 그대로라 움직임·부착 지점은 달라지지 않는다.
 */
export function compactModel<T extends Object3D>(root: T): T {
  const visit = (node: Object3D) => {
    const parts: Mesh[] = [];
    for (const c of node.children) {
      if (c instanceof Mesh && !(c instanceof InstancedMesh) && !c.name && c.children.length === 0 && c.visible && isBakeable(c.material)) parts.push(c);
      else visit(c);
    }
    if (parts.length < 2) return;
    const geos = parts.map((m) => {
      m.updateMatrix();
      return bakedPart(m, m.matrix);
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) return;
    const mesh = new Mesh(merged, BAKED_MATERIAL);
    mesh.castShadow = parts.some((p) => p.castShadow);
    mesh.receiveShadow = parts.some((p) => p.receiveShadow);
    parts.forEach((p) => p.removeFromParent());
    node.add(mesh);
  };
  visit(root);
  return root;
}

/**
 * 장면을 떠날 때 그래픽 메모리를 돌려준다 (지오메트리·그림자 지도).
 * 여러 장면이 함께 쓰는 지오메트리도 다음에 그릴 때 다시 올라가므로 지워도 안전하다.
 * 이렇게 해야 17장을 내리 해도 태블릿 메모리가 쌓이지 않는다.
 */
export function disposeScene(scene: Scene) {
  scene.traverse((o) => {
    if (o instanceof Mesh || o instanceof Line || o instanceof Points) {
      o.geometry.dispose();
      if (o instanceof InstancedMesh) o.dispose();
    } else if (o instanceof DirectionalLight) o.dispose();
  });
}

const tmp = new Vector3();

/** 움직이지 않는 소품을 구역(기본 36m)·재질별로 합친다 */
export function mergeStatic(root: Object3D, chunk = 36): Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<string, { mat: Material; cast: boolean; geos: BufferGeometry[] }>();
  root.traverse((o) => {
    if (!(o instanceof Mesh) || o instanceof InstancedMesh || Array.isArray(o.material)) return;
    const mat = o.material as Material;
    const baked = isBakeable(mat);
    let g: BufferGeometry;
    if (baked) g = bakedPart(o, o.matrixWorld);
    else {
      g = o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (g.index) g = g.toNonIndexed();
      g.applyMatrix4(o.matrixWorld);
      fixMirror(g, o.matrixWorld);
    }
    o.getWorldPosition(tmp);
    const cast = o.castShadow && !mat.transparent;
    const key = `${Math.floor(tmp.x / chunk)},${Math.floor(tmp.z / chunk)}|${baked ? 'baked' : mat.uuid}|${cast ? 1 : 0}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { mat: baked ? BAKED_MATERIAL : mat, cast, geos: [] }));
    b.geos.push(g);
  });
  const out = new Group();
  for (const { mat, cast, geos } of buckets.values()) {
    const attrsSame = geos.every((g) => Object.keys(g.attributes).sort().join() === Object.keys(geos[0].attributes).sort().join());
    const merged = attrsSame ? mergeGeometries(geos, false) : null;
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new Mesh(merged, mat);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}
