/**
 * P0 타이틀 장면 — 칼립소의 섬 해변, 뗏목, 작별 인사.
 * 블록 섬(InstancedMesh) + 출렁이는 바다 + 구름. 캐릭터는 getModel() 이라
 * Codex A4 모델이 들어오면 자동으로 진짜 모델로 바뀐다.
 */
import {
  BackSide, BoxGeometry, BufferAttribute, Color, CylinderGeometry, DirectionalLight, Fog, Group,
  HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, PCFSoftShadowMap,
  PerspectiveCamera, PlaneGeometry, Quaternion, SRGBColorSpace, Scene, ShaderMaterial, SphereGeometry,
  Vector3, WebGLRenderer,
} from 'three';
import { getModel } from '../core/models';
import { block, toonMaterial } from '../core/placeholders';

export interface TitleScene {
  dispose(): void;
}

const CELL = 1.5;
const ISLAND_R = 15;
const SEA_FLOOR = -4;

/** 바다 물결 높이 — 물 메시와 뗏목 흔들림이 같은 식을 쓴다 */
function waveHeight(x: number, z: number, t: number): number {
  return (
    Math.sin(x * 0.09 + t * 1.1) * 0.28 +
    Math.cos(z * 0.11 + t * 0.8) * 0.24 +
    Math.sin((x + z) * 0.05 + t * 0.6) * 0.18
  );
}

function buildSky(): Mesh {
  return new Mesh(
    new SphereGeometry(420, 24, 12),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new Color('#3d9bf0') },
        bottom: { value: new Color('#d8f1ff') },
      },
      vertexShader: /* glsl */ `
        varying float vH;
        void main() {
          vH = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 bottom;
        varying float vH;
        void main() {
          float t = clamp(vH * 1.8 + 0.08, 0.0, 1.0);
          gl_FragColor = vec4(mix(bottom, top, t), 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
}

function buildWater() {
  const geo = new PlaneGeometry(520, 520, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const base = Float32Array.from(geo.attributes.position.array as Float32Array);
  const mesh = new Mesh(
    geo,
    new MeshStandardMaterial({ color: '#2a9df4', roughness: 0.3, metalness: 0.05, flatShading: true }),
  );
  mesh.receiveShadow = true;
  const update = (t: number) => {
    const pos = geo.attributes.position as BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) arr[i + 1] = waveHeight(base[i], base[i + 2], t);
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  return { mesh, update };
}

/** 블록 기둥으로 쌓은 섬. heightAt(x,z) 로 지면 높이를 알려 준다 */
function buildIsland() {
  type Cell = { x: number; z: number; h: number };
  const kinds = { sand: [] as Cell[], grass: [] as Cell[], rock: [] as Cell[] };
  const heights = new Map<string, number>();
  for (let ix = -13; ix <= 13; ix++) {
    for (let iz = -13; iz <= 13; iz++) {
      const x = ix * CELL;
      const z = iz * CELL;
      const n = Math.sin(x * 0.31 + 1.3) * Math.cos(z * 0.27 - 0.4) * 0.8 + Math.sin((x - z) * 0.17) * 0.5;
      const edge = ISLAND_R + n * 2;
      const d = Math.hypot(x, z * 1.15);
      if (d > edge) continue;
      const t = 1 - d / edge;
      const h = Math.max(1, Math.round((0.9 + t * t * 7 + n * 0.8) * 2) / 2);
      const kind = t < 0.24 ? 'sand' : h >= 5 ? 'rock' : 'grass';
      kinds[kind].push({ x, z, h });
      heights.set(`${ix},${iz}`, h);
    }
  }
  const group = new Group();
  const colors = { sand: '#f2d49b', grass: '#6cc24a', rock: '#9aa3ad' };
  const geo = new BoxGeometry(1, 1, 1);
  const m = new Matrix4();
  const q = new Quaternion();
  const tint = new Color();
  for (const kind of ['sand', 'grass', 'rock'] as const) {
    const cells = kinds[kind];
    if (cells.length === 0) continue;
    const inst = new InstancedMesh(geo, toonMaterial(colors[kind]), cells.length);
    cells.forEach((c, i) => {
      m.compose(new Vector3(c.x, (c.h + SEA_FLOOR) / 2, c.z), q, new Vector3(CELL, c.h - SEA_FLOOR, CELL));
      inst.setMatrixAt(i, m);
      const v = 0.9 + ((i * 7919) % 11) / 100;
      inst.setColorAt(i, tint.setRGB(v, v, v));
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    group.add(inst);
  }
  const heightAt = (x: number, z: number) => heights.get(`${Math.round(x / CELL)},${Math.round(z / CELL)}`) ?? 0;
  return { group, heightAt };
}

function buildPalm(lean: number): Group {
  const g = new Group();
  for (let i = 0; i < 6; i++) {
    g.add(block(0.42, 0.8, 0.42, i % 2 ? '#8d6e63' : '#7b5e52', lean * i * i * 0.04, 0.4 + i * 0.75, 0));
  }
  const top = new Group();
  top.position.set(lean * 25 * 0.04, 4.7, 0);
  for (let k = 0; k < 7; k++) {
    const arm = new Group();
    arm.rotation.y = (k / 7) * Math.PI * 2;
    const leaf = block(0.6, 0.12, 2.6, k % 2 ? '#2e9e44' : '#38b552', 0, 0, 1.15);
    leaf.rotation.x = 0.35;
    arm.add(leaf);
    top.add(arm);
  }
  top.add(block(0.3, 0.3, 0.3, '#6d4c2f', 0.25, -0.3, 0.1), block(0.3, 0.3, 0.3, '#6d4c2f', -0.2, -0.35, -0.15));
  g.add(top);
  return g;
}

function buildRaft(): Group {
  const g = new Group();
  const logGeo = new CylinderGeometry(0.22, 0.22, 3.8, 8);
  for (let i = 0; i < 7; i++) {
    const log = new Mesh(logGeo, toonMaterial(i % 2 ? '#a0703f' : '#8b5e34'));
    log.rotation.z = Math.PI / 2;
    log.position.set(((i * 37) % 5) * 0.06, 0.2, -1.32 + i * 0.44);
    log.castShadow = true;
    g.add(log);
  }
  g.add(block(0.18, 3.4, 0.18, '#6d4c2f', 0, 1.9, 0));
  g.add(block(0.06, 2.1, 2.0, '#fff8e1', 0.1, 2.35, 0));
  g.add(block(0.07, 0.35, 2.02, '#e74c3c', 0.1, 2.7, 0));
  return g;
}

function buildClouds(): Group {
  const g = new Group();
  for (let c = 0; c < 9; c++) {
    const cloud = new Group();
    const a = (c / 9) * Math.PI * 2 + 0.3;
    const r = 70 + ((c * 37) % 60);
    cloud.position.set(Math.cos(a) * r, 34 + ((c * 13) % 16), Math.sin(a) * r);
    const puffs = 3 + (c % 3);
    for (let p = 0; p < puffs; p++) {
      const s = 5 + ((p * 7 + c) % 4) * 1.5;
      const puff = block(s * 1.4, s * 0.7, s, '#ffffff', (p - puffs / 2) * 4.2, (p % 2) * 1.6, ((p * 3) % 4) - 2);
      puff.castShadow = false;
      cloud.add(puff);
    }
    g.add(cloud);
  }
  return g;
}

function part(model: Object3D, name: string): Object3D {
  return model.getObjectByName(name) ?? new Object3D();
}

export function startTitleScene(canvas: HTMLCanvasElement): TitleScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  scene.fog = new Fog('#d8f1ff', 80, 260);
  const camera = new PerspectiveCamera(50, 1, 0.1, 1200);

  scene.add(buildSky());
  scene.add(new HemisphereLight('#dff3ff', '#e9d9a8', 1.3));
  const sun = new DirectionalLight('#fff1d6', 2.4);
  sun.position.set(30, 45, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 140 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  const water = buildWater();
  scene.add(water.mesh);
  const island = buildIsland();
  scene.add(island.group);
  const clouds = buildClouds();
  scene.add(clouds);

  const palms: [number, number, number, number][] = [
    [-4, -6, 0.6, 1.0], [2, -9, -1.1, 0.9], [-9, 2, 0.3, 1.1], [7, 7, 1.4, 1.0], [-3, 9, -0.8, 0.95],
  ];
  for (const [x, z, rot, scale] of palms) {
    const p = buildPalm(1);
    p.position.set(x, island.heightAt(x, z), z);
    p.rotation.y = rot;
    p.scale.setScalar(scale);
    scene.add(p);
  }

  const raft = buildRaft();
  raft.position.set(18.5, 0, 2.5);
  scene.add(raft);

  const hero = getModel('odysseus');
  const heroPos = new Vector3(13.6, 0, 2.2);
  heroPos.y = island.heightAt(heroPos.x, heroPos.z);
  hero.position.copy(heroPos);
  hero.rotation.y = Math.PI / 2 + 0.35;
  scene.add(hero);

  const calypso = getModel('calypso');
  const calPos = new Vector3(8.5, 0, -1.2);
  calPos.y = island.heightAt(calPos.x, calPos.z);
  calypso.position.copy(calPos);
  calypso.rotation.y = Math.PI / 2 + 0.9;
  scene.add(calypso);

  const heroParts = { head: part(hero, 'head'), armL: part(hero, 'armL'), armR: part(hero, 'armR') };
  const calParts = { armL: part(calypso, 'armL'), head: part(calypso, 'head') };

  // 제목이 하늘 쪽에 오도록 시선을 섬보다 조금 위로
  const focus = new Vector3(9, 5.2, 0.5);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 세로 화면(폰)에서는 조금 더 멀리서
    camera.fov = w < h ? 62 : 50;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  let raf = 0;
  let last = performance.now();
  let t = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt * (reduceMotion ? 0.3 : 1);

    water.update(t);
    raft.position.y = waveHeight(raft.position.x, raft.position.z, t) + 0.05;
    raft.rotation.z = Math.sin(t * 1.1) * 0.05;
    raft.rotation.x = Math.cos(t * 0.9) * 0.04;

    heroParts.head.rotation.y = Math.sin(t * 0.5) * 0.35;
    heroParts.armL.rotation.x = Math.sin(t * 1.6) * 0.06;
    heroParts.armR.rotation.x = -Math.sin(t * 1.6) * 0.06;
    hero.position.y = heroPos.y + Math.abs(Math.sin(t * 1.6)) * 0.02;

    calParts.armL.rotation.x = -2.7;
    calParts.armL.rotation.z = Math.sin(t * 6) * 0.3;
    calParts.head.rotation.z = Math.sin(t * 1.2) * 0.08;

    clouds.rotation.y = t * 0.004;

    const a = 0.62 + Math.sin(t * 0.06) * 0.35;
    const r = camera.aspect < 1 ? 34 : 27;
    camera.position.set(focus.x + Math.cos(a) * r, 10 + Math.sin(t * 0.1) * 1.2, focus.z + Math.sin(a) * r);
    camera.lookAt(focus);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
