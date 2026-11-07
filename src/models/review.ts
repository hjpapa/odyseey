/** Local art review, intentionally separate from the gameplay entry point. */
import { Box3, DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getModel } from '../core/models';
import { placeholderModel } from '../core/placeholders';
import { CREATURE_IDS, DEFAULT_AVATAR, HUMANOID_IDS, type CreatureId, type HelmetId, type HumanoidId, type ModelId } from '../types/contracts';
import { HumanoidRig } from '../play/rig';
import { CHARACTER_LOOKS } from './humanoids';
import { CREATURE_NAMES } from './creatures';
import { disc } from './geometry';
import { shield, sword } from './equipment';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage');
const picker = $<HTMLSelectElement>('character');
const pose = $<HTMLSelectElement>('pose');
const compare = $<HTMLInputElement>('compare');
const rotate = $<HTMLInputElement>('rotate');
const variant = $<HTMLSelectElement>('variant');
const helmet = $<HTMLSelectElement>('helmet');
const tunic = $<HTMLInputElement>('tunic');
const cape = $<HTMLInputElement>('cape');
const capeOn = $<HTMLInputElement>('cape-on');
const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = SRGBColorSpace;
renderer.setClearColor(0, 0);
renderer.domElement.setAttribute('aria-label', '게임 캐릭터 3D 화면');
stage.prepend(renderer.domElement);
const scene = new Scene();
scene.add(new HemisphereLight('#fff4df', '#8aa6a0', 2.0));
const sun = new DirectionalLight('#fff4e3', 2.3); sun.position.set(4, 8, 7); scene.add(sun);
const rim = new DirectionalLight('#badbd8', 1.5); rim.position.set(-5, 4, -4); scene.add(rim);
const camera = new PerspectiveCamera(34, 1, .1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 3; controls.maxDistance = 24;
controls.maxPolarAngle = Math.PI / 2;

const displayName = (id: ModelId) => CHARACTER_LOOKS[id as HumanoidId]?.name ?? CREATURE_NAMES[id as CreatureId] ?? id;
for (const id of [...HUMANOID_IDS, ...CREATURE_IDS]) {
  const option = document.createElement('option'); option.value = id; option.textContent = displayName(id); picker.append(option);
}
const param = new URLSearchParams(location.search).get('character');
if (param && [...HUMANOID_IDS, ...CREATURE_IDS].some(id => id === param)) picker.value = param;
else if (innerWidth < 760) picker.value = 'odysseus';
let shelf = new Group(); scene.add(shelf);
let rigs: { model: Group; rig: HumanoidRig; baseY: number }[] = [];
let time = 0;

function avatar() { return { ...DEFAULT_AVATAR, helmet: helmet.value as HelmetId, tunicColor: tunic.value, capeColor: capeOn.checked ? cape.value : null }; }
function resetCamera(back = false) {
  const multi = picker.value === 'lineup' && !compare.checked;
  const distance = multi ? Math.max(10.5, 19 / camera.aspect) : compare.checked ? Math.max(7.8, 8 / camera.aspect) : Math.max(6, 4 / camera.aspect);
  camera.position.set(0, multi ? 3.6 : 2.8, back ? -distance : distance);
  controls.target.set(0, 1.25, 0); controls.update();
}
function rebuild() {
  scene.remove(shelf); shelf = new Group(); scene.add(shelf); rigs = [];
  const selected = picker.value === 'lineup' ? 'odysseus' : picker.value as ModelId;
  const ids: ModelId[] = compare.checked ? [selected, selected] : picker.value === 'lineup' ? ['odysseus','athena','hermes','calypso','poseidon'] : [selected];
  $('names').replaceChildren();
  ids.forEach((id, index) => {
    const old = compare.checked && index === 0;
    const opts = { avatar: avatar(), variant: Number(variant.value) };
    const model = old ? placeholderModel(id, opts) : getModel(id, opts);
    if (id === 'odysseus' && !old) {
      model.getObjectByName('handR')!.add(sword());
      model.getObjectByName('handL')!.add(shield(DEFAULT_AVATAR.shieldColor));
    }
    const bounds = new Box3().setFromObject(model);
    model.scale.multiplyScalar(2.65 / (bounds.max.y - bounds.min.y));
    model.rotation.y = -.20;
    model.position.set((index - (ids.length - 1) / 2) * (ids.length > 2 ? 2.25 : 2.5), .14, 0);
    shelf.add(model);
    disc(shelf, '#d9d6c5', .78, .12, model.position.x, .06, 0, 48);
    rigs.push({ model, rig: new HumanoidRig(model), baseY: .14 });
    const label = document.createElement('div'); label.textContent = (old ? '기존 · ' : compare.checked ? '변경 · ' : '') + displayName(id);
    const small = document.createElement('small'); small.textContent = old ? '임시 블록' : id === 'odysseus' ? '청동 투구 · 튜닉 · 망토' : id === 'hermes' ? '날개 모자 · 전령의 지팡이' : id === 'poseidon' ? '파도 왕관 · 삼지창' : id === 'athena' ? '부엉이 투구 · 방패' : id === 'calypso' ? '꽃관 · 바다빛 주름옷' : '에게해 컬렉션';
    label.append(small); $('names').append(label);
  });
  const lineup = picker.value === 'lineup' && !compare.checked;
  $('name').textContent = lineup ? '신화 속 다섯 인물' : displayName(selected);
  $('scene-title').textContent = compare.checked ? '같은 캐릭터, 달라진 옷차림' : $('name').textContent;
  $('description').textContent = lineup ? '같은 세계에 살지만, 옷차림과 상징만으로도 알아볼 수 있게.' : CHARACTER_LOOKS[selected as HumanoidId]?.role ?? '각진 형태에 부드러운 모서리와 밝은 표정을 더한 신화 속 친구.';
  $('avatar').hidden = selected !== 'odysseus' || lineup;
  variant.disabled = !['crewman','suitor','greekSoldier','lotusEater'].includes(selected) || lineup;
  $('health').textContent = '게임 모델 연결됨 · 36종';
  resetCamera();
}
function resize() {
  const { width, height } = stage.getBoundingClientRect();
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); resetCamera();
}
for (const control of [picker, compare, variant, helmet, tunic, cape, capeOn]) control.addEventListener('change', rebuild);
$('front').addEventListener('click', () => { shelf.rotation.y = 0; resetCamera(); });
$('back').addEventListener('click', () => { shelf.rotation.y = 0; resetCamera(true); });
new ResizeObserver(resize).observe(stage);
rebuild(); resize();
let prev = performance.now();
renderer.setAnimationLoop(now => {
  const dt = Math.min(.05, (now - prev) / 1000); prev = now; time += dt;
  if (rotate.checked) shelf.rotation.y += dt * .25;
  for (const { model, rig, baseY } of rigs) {
    const attack = pose.value === 'attack';
    const phase = time % 2;
    const { bodyYaw } = rig.update(dt, { speed:pose.value === 'walk' ? .75 : 0, grounded:pose.value !== 'jump', swing:attack && phase < .55 ? phase / .55 : null, combo:0 });
    model.rotation.y = -.20 + bodyYaw;
    model.position.y = baseY + (pose.value === 'jump' ? .18 : 0);
  }
  controls.update(); renderer.render(scene, camera);
});
