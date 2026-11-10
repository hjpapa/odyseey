/** 하늘·빛·바다 — 장면 분위기(mood)별 */
import {
  BackSide, BufferAttribute, Color, DirectionalLight, Fog, HemisphereLight, Mesh, MeshStandardMaterial,
  PlaneGeometry, type Scene, ShaderMaterial, SphereGeometry, type Vector3,
} from 'three';

export type Mood = 'day' | 'memory' | 'storm' | 'dusk';

const MOODS: Record<Mood, { top: string; bottom: string; fog: string; fogNear: number; fogFar: number; hemiSky: string; hemiGround: string; hemi: number; sun: string; sunI: number; water: string; waveAmp: number }> = {
  day: { top: '#3d9bf0', bottom: '#d8f1ff', fog: '#d8f1ff', fogNear: 80, fogFar: 260, hemiSky: '#dff3ff', hemiGround: '#e9d9a8', hemi: 1.3, sun: '#fff1d6', sunI: 2.4, water: '#2a9df4', waveAmp: 1 },
  memory: { top: '#7a6fd6', bottom: '#ffd3c4', fog: '#f6cdd0', fogNear: 70, fogFar: 230, hemiSky: '#ffe3f0', hemiGround: '#d9c3a0', hemi: 1.25, sun: '#ffd9b0', sunI: 2.2, water: '#5b8fd8', waveAmp: 0.8 },
  storm: { top: '#2b3550', bottom: '#5d6b80', fog: '#4b586c', fogNear: 30, fogFar: 150, hemiSky: '#8fa0b8', hemiGround: '#3a4250', hemi: 1.1, sun: '#c9d6ea', sunI: 1.2, water: '#2b5f86', waveAmp: 2.2 },
  dusk: { top: '#34407a', bottom: '#f6a86b', fog: '#e7a27a', fogNear: 70, fogFar: 230, hemiSky: '#ffd2b0', hemiGround: '#7a6a5a', hemi: 1.1, sun: '#ffb070', sunI: 1.8, water: '#3a6fa8', waveAmp: 1 },
};

/** 바다 물결 높이 — 물 메시와 떠 있는 물체가 같은 식을 쓴다 */
export function waveHeight(x: number, z: number, t: number, amp = 1): number {
  return amp * (
    Math.sin(x * 0.09 + t * 1.1) * 0.28 +
    Math.cos(z * 0.11 + t * 0.8) * 0.24 +
    Math.sin((x + z) * 0.05 + t * 0.6) * 0.18
  );
}

export interface Environment {
  mood: Mood;
  sun: DirectionalLight;
  waveAmp: number;
  /** 그림자·바다를 플레이어 주변으로 옮긴다 */
  follow(focus: Vector3): void;
  update(t: number): void;
  waterHeight(x: number, z: number, t: number): number;
}

const SEG = 90;
const SIZE = 520;

export function createEnvironment(scene: Scene, mood: Mood): Environment {
  const m = MOODS[mood];
  scene.fog = new Fog(m.fog, m.fogNear, m.fogFar);
  scene.background = new Color(m.bottom);

  const sky = new Mesh(
    new SphereGeometry(420, 24, 12),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new Color(m.top) }, bottom: { value: new Color(m.bottom) } },
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
  sky.renderOrder = -1;
  scene.add(sky);

  scene.add(new HemisphereLight(m.hemiSky, m.hemiGround, m.hemi));
  const sun = new DirectionalLight(m.sun, m.sunI);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 160 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const geo = new PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const base = Float32Array.from(geo.attributes.position.array as Float32Array);
  const water = new Mesh(geo, new MeshStandardMaterial({ color: m.water, roughness: 0.3, metalness: 0.05, flatShading: true }));
  water.receiveShadow = true;
  scene.add(water);

  const cellSize = SIZE / SEG;
  let ox = 0;
  let oz = 0;
  const amp = m.waveAmp;

  return {
    mood,
    sun,
    waveAmp: amp,
    follow(focus) {
      sun.position.set(focus.x + 30, focus.y + 45, focus.z + 25);
      sun.target.position.copy(focus);
      sky.position.set(focus.x, 0, focus.z);
      ox = Math.round(focus.x / cellSize) * cellSize;
      oz = Math.round(focus.z / cellSize) * cellSize;
      water.position.set(ox, 0, oz);
    },
    update(t) {
      const pos = geo.attributes.position as BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) arr[i + 1] = waveHeight(base[i] + ox, base[i + 2] + oz, t, amp);
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    },
    waterHeight: (x, z, t) => waveHeight(x, z, t, amp),
  };
}
