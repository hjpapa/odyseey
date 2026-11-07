/**
 * 개발용 모델 갤러리 — http://localhost:5173/dev/model-gallery.html
 * 등록된 진짜 모델(초록 이름)과 임시 블록(빨간 이름)을 한눈에 보고, 관절이 제대로 도는지 확인한다.
 */
import { Color, DirectionalLight, GridHelper, Group, HemisphereLight, Object3D, PerspectiveCamera, SRGBColorSpace, Scene, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { CREATURE_IDS, HUMANOID_IDS, PROP_IDS, type ModelId } from '../src/types/contracts';
import { getModel, hasRealModel } from '../src/core/models';

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const labels = new CSS2DRenderer();
Object.assign(labels.domElement.style, { position: 'fixed', top: '0', left: '0', pointerEvents: 'none' });
document.body.appendChild(labels.domElement);

const scene = new Scene();
scene.background = new Color('#cfe8ff');
scene.add(new HemisphereLight('#ffffff', '#b9a77f', 1.6));
const sun = new DirectionalLight('#ffffff', 2);
sun.position.set(20, 40, 30);
scene.add(sun);
const camera = new PerspectiveCamera(45, 1, 0.1, 2000);
camera.position.set(0, 30, 70);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const filter = $<HTMLSelectElement>('filter');
const animate = $<HTMLInputElement>('animate');
const variant = $<HTMLInputElement>('variant');
const stats = $<HTMLSpanElement>('stats');

let shelf = new Group();
scene.add(shelf);

function idsFor(kind: string): readonly ModelId[] {
  if (kind === 'humanoid') return HUMANOID_IDS;
  if (kind === 'creature') return CREATURE_IDS;
  if (kind === 'prop') return PROP_IDS;
  return [...HUMANOID_IDS, ...CREATURE_IDS, ...PROP_IDS];
}

function rebuild() {
  scene.remove(shelf);
  shelf.traverse((o) => { if (o instanceof CSS2DObject) o.element.remove(); });
  shelf = new Group();
  const ids = idsFor(filter.value);
  const perRow = Math.ceil(Math.sqrt(ids.length * 1.6));
  let x = 0, z = 0, rowDepth = 0, col = 0, maxX = 0;
  for (const id of ids) {
    const model = getModel(id, { variant: Number(variant.value) || 0 });
    const h = (model.userData.height as number) || 2;
    const r = (model.userData.radius as number) || 1;
    const w = Math.max(4, r * 2 + 2);
    model.position.set(x + w / 2, 0, z);
    shelf.add(model);
    const div = document.createElement('div');
    const real = hasRealModel(id);
    div.className = `label ${real ? 'real' : 'temp'}`;
    div.textContent = real ? id : `${id} (임시)`;
    const label = new CSS2DObject(div);
    label.position.set(0, h + 0.4, 0);
    model.add(label);
    x += w;
    rowDepth = Math.max(rowDepth, w);
    maxX = Math.max(maxX, x);
    if (++col >= perRow) { col = 0; x = 0; z += rowDepth + 2; rowDepth = 0; }
  }
  shelf.position.set(-maxX / 2, 0, -z / 2);
  const grid = new GridHelper(Math.max(maxX, z) + 20, Math.round((Math.max(maxX, z) + 20) / 2), '#7aa6d6', '#a9c8ea');
  shelf.add(grid);
  grid.position.set(maxX / 2, 0, z / 2);
  scene.add(shelf);
  const realCount = idsFor('all').filter(hasRealModel).length;
  stats.textContent = `진짜 모델 ${realCount} / 전체 ${idsFor('all').length}`;
}

const JOINTS = ['armL', 'armR', 'legL', 'legR', 'head', 'wingL', 'wingR', 'tail', 'leg0', 'leg1', 'leg2', 'leg3'];
function animateRigs(t: number) {
  shelf.traverse((o: Object3D) => {
    if (!JOINTS.includes(o.name)) return;
    const s = Math.sin(t * 3);
    if (o.name === 'head') o.rotation.y = s * 0.4;
    else if (o.name.startsWith('wing')) o.rotation.z = (o.name === 'wingL' ? 1 : -1) * s * 0.6;
    else if (o.name === 'tail') o.rotation.y = s * 0.5;
    else {
      const sign = o.name === 'armL' || o.name === 'legR' || o.name === 'leg0' || o.name === 'leg3' ? 1 : -1;
      o.rotation.x = sign * s * 0.6;
    }
  });
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  labels.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
filter.addEventListener('change', rebuild);
variant.addEventListener('change', rebuild);
resize();
rebuild();

renderer.setAnimationLoop((now) => {
  if (animate.checked) animateRigs(now / 1000);
  controls.update();
  renderer.render(scene, camera);
  labels.render(scene, camera);
});
