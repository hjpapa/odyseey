/** 섬마다 다른 수평선. 장식은 육지 밖에 두고 충돌이나 그림자를 더하지 않는다. */
import { Group, Mesh, type Object3D } from 'three';
import type { IslandId, IslandLayout, PropId } from '../types/contracts';
import { block } from '../core/placeholders';
import type { Atmosphere } from './environment';
import { mergeStatic } from './merge';
import { makeProp } from './props';

const ATMOSPHERES: Partial<Record<IslandId, Partial<Atmosphere>>> = {
  ogygia: { top: '#329fd2', bottom: '#e7f5e5', fog: '#d8eee0', water: '#27a9bd', sun: '#fff0c8', waveAmp: 0.65 },
  cyclops: { top: '#7279ac', bottom: '#d7d7df', fog: '#d6d5dd', hemiGround: '#bab4ba', water: '#477e9b', sun: '#fff0d9' },
  lotus: { top: '#b68cce', bottom: '#ffe2df', fog: '#f5dbe4', water: '#629daf', sun: '#fff0df', waveAmp: 0.45 },
  aeolia: { top: '#74bde6', bottom: '#f2f2dd', fog: '#e8eedf', water: '#6aaac6', sun: '#fff4d2', waveAmp: 0.55 },
  laestrygonia: { top: '#6c86a2', bottom: '#d9e1de', fog: '#cddad9', water: '#4f8294', sun: '#f4e3ca' },
  aeaea: { top: '#8583b8', bottom: '#e9e2ed', fog: '#ddddeb', hemiSky: '#eee5ff', water: '#6a94b2', waveAmp: 0.5 },
  underworld: {
    top: '#363e69', bottom: '#bbc6dd', fog: '#a8bad0', fogNear: 55, fogFar: 180,
    hemiSky: '#d8e3ff', hemiGround: '#71849b', hemi: 1.65, sun: '#d9ddff', sunI: 1.65, water: '#617f9a', waveAmp: 0.25,
  },
  thrinacia: { top: '#65b9df', bottom: '#fff1be', fog: '#f5e4b9', hemiGround: '#d7bd7a', water: '#4aabb7', sun: '#fff0b0', waveAmp: 0.4 },
  sirens: { top: '#9387bd', bottom: '#f0d8df', fog: '#e9d4e1', water: '#6c8eaf', sun: '#f8e5df', waveAmp: 0.7 },
  scheria: { top: '#44a8d7', bottom: '#e9f5ed', fog: '#e0eeed', water: '#3ba9bb', sun: '#fff1d8', waveAmp: 0.5 },
  ithaca: { top: '#78afca', bottom: '#fff0ce', fog: '#efdfc2', water: '#5c9fba', sun: '#ffdfb1', waveAmp: 0.45 },
  ithacaPalace: { top: '#6d9bab', bottom: '#efe4d2', fog: '#eee2cf', hemiSky: '#fff5df', hemiGround: '#c6b69f', sun: '#fff2d3', sunI: 1.8 },
};

interface Flora {
  density: number;
  props: readonly PropId[];
}

const FLORA: Partial<Record<IslandId, Flora>> = {
  ogygia: { density: 0.9, props: ['grassTuft', 'flowerPatch', 'flowerPatch', 'bush'] },
  cyclops: { density: 0.5, props: ['grassTuft', 'grassTuft', 'bush'] },
  lotus: { density: 1, props: ['lotus', 'lotus', 'flowerPatch', 'bush'] },
  aeolia: { density: 0.6, props: ['grassTuft', 'grassTuft', 'flowerPatch'] },
  laestrygonia: { density: 0.45, props: ['grassTuft', 'bush'] },
  aeaea: { density: 0.85, props: ['molyFlower', 'molyFlower', 'flowerPatch', 'bush'] },
  underworld: { density: 0.4, props: ['grassTuft', 'grassTuft', 'torch'] },
  thrinacia: { density: 0.75, props: ['grassTuft', 'grassTuft', 'flowerPatch'] },
  sirens: { density: 0.45, props: ['grassTuft', 'grassTuft', 'flowerPatch'] },
  scheria: { density: 0.9, props: ['flowerPatch', 'flowerPatch', 'bush'] },
  ithaca: { density: 0.65, props: ['grassTuft', 'bush', 'bush'] },
};

export const destinationAtmosphere = (id: IslandId): Partial<Atmosphere> => ATMOSPHERES[id] ?? {};
export const destinationFlora = (id: IslandId): Flora => FLORA[id] ?? FLORA.ogygia!;

/** 공유 블록·소품을 한 번 조립한 뒤 구역별 정점 색 메시로 합친다. 매 프레임 작업은 없다. */
export function createDestinationScenery(layout: IslandLayout): Group {
  const raw = new Group();
  if (layout.kind === 'seaCourse') return raw;
  const far = layout.terrain.radius + 30;

  const marble = '#e9e0ce';
  const blue = '#4e86aa';
  const gold = '#e2bb67';
  const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number) => {
    const mesh = block(w, h, d, color, x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    raw.add(mesh);
    return mesh;
  };
  const model = (id: PropId, x: number, y: number, z: number, scale = 1, rotY = 0) => {
    const object = makeProp(id);
    object.position.set(x, y, z);
    object.scale.setScalar(scale);
    object.rotation.y = rotY;
    object.traverse((part) => {
      if (part instanceof Mesh) {
        part.castShadow = false;
        part.receiveShadow = false;
      }
    });
    raw.add(object);
    return object;
  };

  switch (layout.id) {
    case 'ogygia':
      // 칼립소의 초록 덩굴이 늘어진 바다 아치.
      box(10, 15, 12, '#bcbea3', -14, 6, far);
      box(10, 18, 12, '#aab69a', 14, 7.5, far + 2);
      box(37, 5, 13, '#c7cbb2', 0, 16, far + 1);
      box(30, 1.5, 11, '#82a575', 0, 19, far + 1);
      for (let i = 0; i < 9; i++) {
        const length = 2.5 + (i % 3) * 1.4;
        box(0.55, length, 0.7, '#6b9569', -14 + i * 3.5, 17 - length / 2, far - 6);
      }
      model('palmTree', -28, 1, far + 5, 2.1, 0.8);
      model('palmTree', 29, 1, far + 7, 2.4, 2);
      break;

    case 'cyclops':
      // 무너진 현무암 곶 세 개가 외눈 거인의 섬을 둘러싼다.
      for (const [x, height, depth] of [[-30, 22, 6], [-6, 29, 0], [24, 18, 10]]) {
        box(14, height, 14, '#78818d', x, height / 2 - 2, far + depth);
        box(9, height * 0.65, 10, '#969daa', x - 2, height * 0.55, far + depth + 1);
        model('boulder', x + 1, height - 2, far + depth, 3.2);
      }
      model('caveEntrance', -8, 0, far - 10, 2.4, Math.PI);
      break;

    case 'lotus':
      // 낮은 수면에 커다란 연꽃이 떠 있는 연꽃 호수.
      for (const [x, offset, scale] of [[-32, -2, 1.1], [0, 12, 1.55], [34, 3, 0.95]]) {
        const z = far + offset;
        box(11 * scale, 0.3, 10 * scale, '#709d82', x, 0.2, z);
        for (let petal = 0; petal < 6; petal++) {
          const angle = petal * Math.PI / 3;
          const leaf = box(2.4 * scale, 0.8 * scale, 6 * scale, '#e9b2cb', x + Math.sin(angle) * 2.2 * scale, 1 * scale, z + Math.cos(angle) * 2.2 * scale);
          leaf.rotation.y = angle;
          leaf.rotation.x = -0.2;
        }
        box(2.6 * scale, 1.5 * scale, 2.6 * scale, '#ecd49a', x, 1.7 * scale, z);
      }
      break;

    case 'aeolia':
      // 구름 위 테라스와 바람 깃발이 있는 아이올로스의 집.
      box(39, 3, 19, '#abbfc4', 0, 15, far);
      box(31, 2, 15, '#e6e7d8', 0, 17.5, far);
      model('temple', 0, 19, far + 1, 3);
      for (const [x, y, z] of [[-27, 13, -6], [24, 11, 1], [-8, 10, 6], [11, 12, -3]]) {
        box(16, 3, 7, '#e9f0ed', x, y, far + z);
        box(10, 2.5, 8, '#f6f4df', x + 3, y + 1.4, far + z);
      }
      for (const x of [-20, 20]) {
        box(0.5, 12, 0.5, '#b9a97f', x, 24, far);
        box(6, 2, 0.25, '#89c4cf', x + 2.7, 29, far);
      }
      break;

    case 'laestrygonia':
      // 거대한 항만 방파제와 성벽. 낮은 부두가 앞쪽으로 튀어나온다.
      box(62, 10, 12, '#8c9da3', 0, 3, far + 4);
      for (const x of [-25, 25]) {
        box(13, 26, 14, '#81939d', x, 11, far + 3);
        box(16, 3, 16, '#b1b8af', x, 25, far + 3);
        for (const offset of [-5, 0, 5]) box(2.6, 3, 3, '#bfc2b2', x + offset, 28, far - 3);
      }
      model('dock', 0, 0.5, far - 12, 3.2);
      model('ship', -12, 0.4, far - 9, 1.9, 0.4);
      box(1, 13, 1, '#8c775d', 9, 7, far - 6);
      box(12, 1, 1, '#ad9672', 4, 13, far - 6);
      break;

    case 'aeaea':
      // 키르케의 보랏빛 성소는 키 큰 침엽수 사이에 보인다.
      box(33, 7, 18, '#9291a8', 10, 1.5, far + 4);
      box(24, 3, 14, '#b8b0c0', 10, 6.5, far + 4);
      model('temple', 10, 8, far + 4, 2.8);
      box(18, 2, 13, '#a08fb6', 10, 19, far + 4);
      for (const [x, offset, scale] of [[-34, 0, 3.4], [-23, 4, 4.2], [-12, -1, 3], [30, 0, 3.7], [40, 6, 3]]) {
        model('pineTree', x, 0, far + offset, scale, x * 0.07);
      }
      break;

    case 'underworld':
      // 밝은 안개 속 끊어진 돌기둥과 등불, 초승달 표식.
      box(44, 3, 19, '#69788d', 0, -0.2, far);
      for (const [x, height, offset] of [[-21, 20, 3], [-10, 13, 0], [15, 25, 4], [28, 10, 10]]) {
        box(3.8, height, 4, '#8998ac', x, height / 2, far + offset);
        box(6, 1, 6, '#bbc7ce', x, height + 0.5, far + offset);
      }
      for (let i = 0; i < 11; i++) {
        const angle = (0.25 + i * 0.15) * Math.PI;
        const moon = box(1.2, 2.5, 0.8, '#d5ebe3', 4 + Math.sin(angle) * 7, 24 + Math.cos(angle) * 7, far + 3);
        moon.rotation.z = -angle;
      }
      for (const x of [-17, -8, 1, 10, 19]) {
        box(1.2, 3.5, 1.2, '#66778b', x, 2.6, far - 8);
        box(1.6, 1.4, 1.6, '#efd7a5', x, 4.8, far - 8);
      }
      break;

    case 'thrinacia':
      // 황금빛 해의 문양이 솟아 있는 하얀 기둥 언덕.
      box(43, 4, 19, '#c1ac75', 0, 0.5, far);
      box(34, 2, 16, '#e9d8a7', 0, 3.5, far);
      for (const x of [-16, -8, 8, 16]) model('column', x, 4.5, far, 3.3);
      box(39, 2, 7, marble, 0, 16, far);
      box(7, 7, 1.1, '#eed28b', 0, 24, far);
      for (let ray = 0; ray < 12; ray++) {
        const angle = ray * Math.PI / 6;
        const spoke = box(0.8, 3.4, 0.8, gold, Math.sin(angle) * 7.4, 24 + Math.cos(angle) * 7.4, far);
        spoke.rotation.z = -angle;
      }
      break;

    case 'sirens':
      // 가느다란 바다 바위 사이, 거대한 리라 모양의 돌기둥.
      for (const [x, height, offset] of [[-30, 13, 7], [-19, 24, 1], [20, 28, 3], [33, 17, 10]]) {
        box(5.5, height, 7, '#9297b1', x, height / 2 - 1, far + offset);
        model('boulder', x, height - 2, far + offset, 1.8);
      }
      box(3, 20, 4, '#bcb4bb', -9, 12, far);
      box(3, 20, 4, '#bcb4bb', 9, 12, far);
      box(22, 2, 5, '#c9bec1', 0, 3, far);
      box(22, 2, 5, '#c9bec1', 0, 22, far);
      for (let string = -2; string <= 2; string++) box(0.3, 16, 0.4, '#e4cd9b', string * 2.6, 12.5, far - 1.5);
      break;

    case 'scheria':
      // 파이아케스의 푸른 지붕과 층층이 쌓인 하얀 항구 도시.
      box(69, 4, 24, '#c7c5b2', 0, 0.5, far + 3);
      box(52, 5, 18, marble, 0, 4.5, far + 5);
      box(35, 4, 15, '#d7d3c0', 0, 8.5, far + 6);
      for (const [x, y, offset] of [[-26, 3, -3], [25, 3, 0], [-15, 8, 4], [15, 8, 6]]) {
        model('house', x, y, far + offset, 2.1, Math.PI);
        box(9, 1.2, 6.5, blue, x, y + 6.2, far + offset);
      }
      model('palace', 0, 10.5, far + 8, 2.7, Math.PI);
      break;

    case 'ithaca':
      // 고향의 완만한 올리브 언덕, 작은 황토 지붕과 돌 전망대.
      box(66, 5, 24, '#a1b685', 0, 0.5, far + 4);
      box(49, 4, 19, '#b5bd8e', 0, 4.5, far + 5);
      for (const [x, offset, scale] of [[-27, 0, 2.4], [-17, 5, 2.8], [19, 0, 2.6], [30, 8, 2.3]]) {
        model('oliveTree', x, 5.5, far + offset, scale, x * 0.1);
      }
      model('house', -5, 7, far + 4, 2.1, Math.PI);
      model('hut', 10, 7, far + 7, 1.7, Math.PI);
      box(5, 13, 6, '#b6b9a3', 29, 6, far + 9);
      box(7, 1.2, 8, '#d2cfb6', 29, 13, far + 9);
      break;

    case 'ithacaPalace': {
      // 천장을 덮지 않아 카메라 시야는 열어 두고, 뒤편 열주와 낮은 모자이크로 실내를 읽는다.
      const rear = layout.terrain.radius + 10;
      for (const x of [-24, -12, 0, 12, 24]) model('column', x, 1, rear, 3.6);
      box(57, 2, 8, marble, 0, 13, rear);
      box(52, 0.6, 6, gold, 0, 14.4, rear);
      for (const x of [-22, 22]) {
        box(4.8, 7, 0.3, '#47748f', x, 8, rear - 2);
        box(1.2, 5.5, 0.35, gold, x, 8, rear - 2.2);
      }
      const edge = layout.terrain.radius - 3.5;
      for (let x = -edge + 2; x <= edge - 2; x += 5) {
        for (const z of [-edge, edge]) {
          box(3.6, 0.035, 1, '#5d8192', x, 1.025, z);
          box(1.4, 0.045, 0.45, '#d4b974', x, 1.035, z);
        }
      }
      break;
    }
  }

  const scenery = mergeStatic(raw);
  scenery.name = `scenery:${layout.id}`;
  return scenery;
}

/** 먼 배경과 작은 식물은 그림자 계산을 늘리지 않는다. */
export function softenSceneryShadows(object: Object3D): void {
  object.traverse((part) => {
    if (part instanceof Mesh) part.castShadow = false;
  });
}
