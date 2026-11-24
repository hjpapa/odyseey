/**
 * 에게해 바다 지도 — 이야기 순서대로 놓인 섬 사이를 배로 오간다.
 * 끝낸 섬은 금빛, 지금 갈 섬은 반짝이고, 아직 못 간 섬은 회색 안개 속에 있다.
 * 3~11장(회상) 섬 둘레에는 분홍빛 '기억의 바다'가 깔린다.
 */
import {
  Box3, BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedMesh, Line, LineBasicMaterial,
  LineDashedMaterial, Matrix4, Mesh, MeshBasicMaterial, CylinderGeometry, PerspectiveCamera, Quaternion,
  Raycaster, RingGeometry, Scene, Vector2, Vector3, type Material, type Object3D,
} from 'three';
import type { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { ChapterData, ChapterId, IslandId, IslandLayout, PropId } from '../types/contracts';
import type { InputFrame } from '../core/input';
import { toonMaterial } from '../core/placeholders';
import { createEnvironment, type Environment } from '../world/environment';
import { compactModel } from '../world/merge';
import { makeProp } from '../world/props';
import { PALETTES } from '../world/terrain';
import { label } from '../play/effects';
import { prefs } from './prefs';
import { sideStoriesAt, sideStoryUnlocked } from '../story/sideStories';
import type { ChapterState } from './progress';
import type { Stage } from './services';

/** 허브 좌표(m, 가로세로 1200) → 장면 좌표 */
const S = 0.12;

export interface HubIsland {
  layout: IslandLayout;
  chapters: ChapterData[];
  state: ChapterState;
  memory: boolean;
}

/** 섬마다 알아보기 쉬운 표지 소품 */
const LANDMARK: Partial<Record<IslandId, PropId[]>> = {
  ogygia: ['palmTree', 'palmTree'],
  cyclops: ['caveEntrance'],
  lotus: ['lotus', 'flowerPatch'],
  aeolia: ['windBag'],
  laestrygonia: ['boulder', 'cliff'],
  aeaea: ['house', 'pineTree'],
  underworld: ['brokenColumn', 'brokenColumn'],
  thrinacia: ['sundial'],
  sirens: ['rock', 'flowerPatch'],
  scheria: ['temple'],
  ithaca: ['oliveTree', 'hut'],
  ithacaPalace: ['palace'],
};

const GRAY = new Color('#9aa3ad');

/** 큰 소품을 지도 크기에 맞게 줄인다 */
function fitSize(obj: Object3D, size: number) {
  const box = new Box3().setFromObject(obj);
  const span = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
  if (span > 0) obj.scale.multiplyScalar(size / span);
}

interface Mini {
  group: Group;
  top: number;
  radius: number;
}

/** 블록으로 쌓은 작은 섬 하나 */
function miniIsland(L: IslandLayout, locked: boolean, owned: { geos: BufferGeometry[]; mats: Material[] }): Mini {
  const group = new Group();
  const pal = PALETTES[L.terrain.palette] ?? PALETTES.tropical;
  const tone = (hex: string) => {
    const c = new Color(hex);
    return locked ? `#${c.lerp(GRAY, 0.75).getHexString()}` : hex;
  };

  if (L.kind === 'seaCourse') {
    // 바다 코스: 섬 대신 표지 — 폭풍은 먹구름, 해협은 소용돌이와 바위 둘
    if (L.id === 'stormSea') {
      const cloud = toonMaterial(locked ? '#8e98a6' : '#4d5a70');
      owned.mats.push(cloud);
      const geo = new BoxGeometry(1, 1, 1);
      owned.geos.push(geo);
      for (const [x, y, z, s] of [[-1.6, 5.2, 0, 2.6], [0.6, 5.8, 0.5, 3.2], [2.2, 5.1, -0.4, 2.2], [0, 4.8, -1.4, 2]]) {
        const m = new Mesh(geo, cloud);
        m.scale.set(s * 1.3, s * 0.6, s);
        m.position.set(x, y, z);
        group.add(m);
      }
      const bolt = new Mesh(geo, toonMaterial(locked ? '#c9ccd2' : '#ffe066'));
      owned.mats.push(bolt.material as Material);
      bolt.scale.set(0.3, 2.6, 0.3);
      bolt.position.set(0.4, 2.6, 0.2);
      bolt.rotation.z = 0.35;
      group.add(bolt);
      return { group, top: 4, radius: 4 };
    }
    const whirl = makeProp('whirlpool');
    fitSize(whirl, 6);
    group.add(whirl);
    for (const s of [-1, 1]) {
      const rock = makeProp('cliff');
      fitSize(rock, 4);
      rock.position.set(s * 4.2, 0, 0);
      group.add(rock);
    }
    return { group, top: 3, radius: 5 };
  }

  const R = L.kind === 'interior' ? 3.6 : Math.min(6.5, Math.max(3.8, L.terrain.radius * 0.075));
  const cell = 0.9;
  const kinds = { sand: [] as number[][], grass: [] as number[][], rock: [] as number[][] };
  let top = 1;
  const n = Math.ceil(R / cell);
  const seed = L.terrain.seed;
  const peak = L.kind === 'interior' ? 0 : Math.min(3.2, 0.8 + L.terrain.maxHeight * 0.18);
  for (let ix = -n; ix <= n; ix++) {
    for (let iz = -n; iz <= n; iz++) {
      const x = ix * cell;
      const z = iz * cell;
      const wob = Math.sin(x * 0.9 + seed) * Math.cos(z * 0.8 - seed * 0.3) * 0.35;
      const d = L.kind === 'interior' ? Math.max(Math.abs(x), Math.abs(z)) : Math.hypot(x, z);
      const edge = R * (0.9 + 0.1 * wob);
      if (d > edge) continue;
      const t = 1 - d / edge;
      const h = L.kind === 'interior' ? 0.9 : Math.max(0.6, Math.round((0.6 + t * t * peak + wob * 0.4) * 4) / 4);
      top = Math.max(top, h);
      const kind = L.kind === 'interior' ? 'grass' : t < 0.28 ? 'sand' : h > peak * 0.75 + 0.6 && peak > 1.5 ? 'rock' : 'grass';
      kinds[kind].push([x, h, z]);
    }
  }
  const geo = new BoxGeometry(1, 1, 1);
  owned.geos.push(geo);
  const m = new Matrix4();
  const q = new Quaternion();
  const FLOOR = -2;
  for (const kind of ['sand', 'grass', 'rock'] as const) {
    const cells = kinds[kind];
    if (!cells.length) continue;
    const mat = toonMaterial(tone(pal[kind]));
    owned.mats.push(mat);
    const inst = new InstancedMesh(geo, mat, cells.length);
    cells.forEach(([x, h, z], i) => {
      inst.setMatrixAt(i, m.compose(new Vector3(x, (h + FLOOR) / 2, z), q, new Vector3(cell, h - FLOOR, cell)));
    });
    group.add(inst);
  }
  // 표지 소품
  const marks = LANDMARK[L.id] ?? [];
  marks.forEach((id, i) => {
    const p = makeProp(id);
    fitSize(p, id === 'palace' ? 5.5 : id === 'cliff' || id === 'temple' || id === 'house' ? 3.2 : 2.4);
    const a = i * 2.4 + 0.6;
    const r = marks.length > 1 ? R * 0.35 : 0;
    p.position.set(Math.cos(a) * r, top, Math.sin(a) * r);
    p.rotation.y = a;
    if (locked) {
      p.traverse((o) => {
        if (o instanceof Mesh) {
          const mat = toonMaterial('#b5bcc5');
          owned.mats.push(mat);
          o.material = mat;
        }
      });
    }
    group.add(p);
  });
  return { group, top, radius: R };
}

export class HubStage implements Stage {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(45, 1, 0.5, 900);
  private env: Environment;
  private t = 0;
  private ship: Group;
  private shipFrom = new Vector3();
  private shipTo = new Vector3();
  private sailT = 1;
  private shipYaw = 0;
  private focus = new Vector3();
  private focusTarget = new Vector3();
  private ring: Mesh;
  private picks: { id: IslandId; obj: Object3D }[] = [];
  private spots = new Map<IslandId, { pos: Vector3; radius: number; top: number }>();
  private tags = new Map<IslandId, CSS2DObject>();
  private storyTags = new Map<IslandId, CSS2DObject>();
  private storyBooks: Group[] = [];
  private ray = new Raycaster();
  private owned = { geos: [] as BufferGeometry[], mats: [] as Material[] };
  private portrait = false;
  /** 엔딩의 '지나온 바닷길': 이름표 없이, 배가 지나간 자리에 금빛 뱃길이 그려진다 */
  private voyage: boolean;
  private sailDur = 1.4;
  private trail: { line: Line; points: Vector3[] } | null = null;
  selected: IslandId;

  constructor(private islands: HubIsland[], selected: IslandId, opts: { voyage?: boolean; completed?: readonly ChapterId[] } = {}) {
    this.voyage = !!opts.voyage;
    // 엔딩의 바닷길은 회상의 빛(분홍 노을) — 지나온 일을 떠올리는 장면
    this.env = createEnvironment(this.scene, this.voyage ? 'memory' : 'day');
    const pickMat = new MeshBasicMaterial({ visible: false });
    const mistMat = new MeshBasicMaterial({ color: '#ffb8dc', transparent: true, opacity: 0.35, depthWrite: false, side: DoubleSide });
    this.owned.mats.push(pickMat, mistMat);
    const bookGeo = new BoxGeometry(1, 1, 1);
    const bookCover = new MeshBasicMaterial({ color: '#b17c31' });
    const bookPage = new MeshBasicMaterial({ color: '#fff6d7' });
    const lockedBook = new MeshBasicMaterial({ color: '#97a5b6' });
    this.owned.geos.push(bookGeo);
    this.owned.mats.push(bookCover, bookPage, lockedBook);

    for (const isl of islands) {
      const L = isl.layout;
      const pos = new Vector3(L.hubPos[0] * S, 0, L.hubPos[1] * S);
      const locked = isl.state === 'locked';
      const mini = miniIsland(L, locked, this.owned);
      mini.group.position.copy(pos);
      compactModel(mini.group);
      this.scene.add(mini.group);
      this.spots.set(L.id, { pos, radius: mini.radius, top: mini.top });

      if (isl.memory) {
        const mistGeo = new RingGeometry(mini.radius * 0.8, mini.radius * 1.9, 32);
        this.owned.geos.push(mistGeo);
        const mist = new Mesh(mistGeo, mistMat);
        mist.rotation.x = -Math.PI / 2;
        mist.position.set(pos.x, 0.35, pos.z);
        this.scene.add(mist);
      }

      const nos = isl.chapters.map((c) => c.no);
      const range = nos.length > 1 ? `${nos[0]}~${nos[nos.length - 1]}장` : `${nos[0]}장`;
      const mark = isl.state === 'done' ? '✅' : isl.state === 'next' ? '⭐' : '🔒';
      const tag = label(`${mark} ${range} ${L.name}`, `nametag hub-tag ${isl.state}`);
      tag.position.set(pos.x, mini.top + 3.2, pos.z);
      tag.visible = !this.voyage;
      this.scene.add(tag);
      this.tags.set(L.id, tag);

      const pickGeo = new CylinderGeometry(mini.radius + 1.5, mini.radius + 1.5, 10, 12);
      this.owned.geos.push(pickGeo);
      const pick = new Mesh(pickGeo, pickMat);
      pick.position.set(pos.x, 3, pos.z);
      this.scene.add(pick);
      this.picks.push({ id: L.id, obj: pick });

      // Small book beacons mark optional original-story stops beside the islands.
      const stories = sideStoriesAt(L.id);
      if (!this.voyage && stories.length) {
        const ready = stories.filter((story) => sideStoryUnlocked(story, opts.completed ?? [])).length;
        const book = new Group();
        book.name = 'side-story-beacon-' + L.id;
        book.position.set(pos.x + mini.radius + 2, 1.2, pos.z + mini.radius * 0.25);
        const cover = new Mesh(bookGeo, ready ? bookCover : lockedBook);
        cover.scale.set(2, 0.15, 1.5);
        book.add(cover);
        for (const side of [-1, 1]) {
          const page = new Mesh(bookGeo, ready ? bookPage : lockedBook);
          page.scale.set(0.86, 0.16, 1.32);
          page.position.set(side * 0.47, 0.17, 0);
          page.rotation.z = side * 0.13;
          book.add(page);
        }
        this.scene.add(book);
        this.storyBooks.push(book);
        const storyTag = label(ready ? '📜 ' + ready + '/' + stories.length : '📜 🔒',
          'nametag hub-story-tag' + (ready ? ' available' : ''));
        storyTag.position.set(book.position.x, 3.5, book.position.z);
        storyTag.element.setAttribute('aria-label', L.name + ' 원작 곁이야기 ' + ready + '편 열림');
        this.scene.add(storyTag);
        this.storyTags.set(L.id, storyTag);
        const storyPickGeo = new CylinderGeometry(2.1, 2.1, 8, 10);
        this.owned.geos.push(storyPickGeo);
        const storyPick = new Mesh(storyPickGeo, pickMat);
        storyPick.position.copy(book.position).setY(3);
        this.scene.add(storyPick);
        this.picks.push({ id: L.id, obj: storyPick });
      }
    }

    // 항로 — 지나온 길은 금빛 실선, 앞으로 갈 길은 흰 점선 (엔딩에서는 배를 따라 그려진다)
    const route = islands.map((i) => this.spots.get(i.layout.id)!.pos.clone().setY(0.5));
    const reached = Math.max(0, islands.findIndex((i) => i.state === 'next'));
    const lastReached = islands.every((i) => i.state === 'done') ? islands.length - 1 : reached;
    if (this.voyage) {
      const geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(new Float32Array(64 * 3), 3));
      geo.setDrawRange(0, 0);
      const mat = new LineBasicMaterial({ color: '#ffd34d' });
      this.owned.geos.push(geo);
      this.owned.mats.push(mat);
      const line = new Line(geo, mat);
      line.frustumCulled = false;
      this.scene.add(line);
      this.trail = { line, points: [] };
    } else if (lastReached > 0) {
      const doneGeo = new BufferGeometry().setFromPoints(route.slice(0, lastReached + 1));
      const doneMat = new LineBasicMaterial({ color: '#ffd34d' });
      this.owned.geos.push(doneGeo);
      this.owned.mats.push(doneMat);
      this.scene.add(new Line(doneGeo, doneMat));
    }
    if (!this.voyage && lastReached < route.length - 1) {
      const todoGeo = new BufferGeometry().setFromPoints(route.slice(lastReached));
      const todoMat = new LineDashedMaterial({ color: '#ffffff', dashSize: 1.4, gapSize: 1.1, transparent: true, opacity: 0.8 });
      this.owned.geos.push(todoGeo);
      this.owned.mats.push(todoMat);
      const todo = new Line(todoGeo, todoMat);
      todo.computeLineDistances();
      this.scene.add(todo);
    }

    // 고른 섬 둘레 반짝이 고리
    const ringGeo = new RingGeometry(1, 1.25, 40);
    const ringMat = new MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.85, depthWrite: false, side: DoubleSide });
    this.owned.geos.push(ringGeo);
    this.owned.mats.push(ringMat);
    this.ring = new Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.scene.add(this.ring);

    this.ship = makeProp('ship');
    fitSize(this.ship, 3.4);
    this.scene.add(this.ship);

    this.selected = selected;
    const spot = this.spots.get(selected) ?? [...this.spots.values()][0];
    this.shipTo.copy(this.harbor(selected));
    this.shipFrom.copy(this.shipTo);
    this.ship.position.copy(this.shipTo);
    this.focus.copy(this.voyage ? this.voyageFocus(selected) : spot.pos);
    this.focusTarget.copy(this.focus);
    this.placeRing();
    if (this.trail) this.trail.points.push(this.shipTo.clone().setY(0.4));
  }

  /** 엔딩: 다음 섬으로 천천히 항해하며 뱃길을 그린다 */
  sailTo(id: IslandId) {
    if (!this.spots.has(id) || id === this.selected) return;
    // 가는 도중에 다음 장으로 넘기면 지금 자리에서 꺾어 간다
    if (this.trail && this.sailT < 1) this.trail.points.push(this.ship.position.clone());
    this.select(id);
    this.sailDur = 2.2;
    // 움직임 줄이기를 켜면 배는 바로 도착한다 — 뱃길도 그 자리까지 바로 그린다
    if (this.sailT >= 1) this.trail?.points.push(this.shipTo.clone());
    this.focusTarget.copy(this.voyageFocus(id));
  }

  /** 섬 앞바다 (배가 머무는 자리) — 엔딩에서는 섬을 가리지 않게 옆쪽 */
  private harbor(id: IslandId): Vector3 {
    const s = this.spots.get(id);
    if (!s) return new Vector3();
    return s.pos.clone().add(this.voyage ? new Vector3(s.radius + 2.6, 0, 1.4) : new Vector3(0, 0, s.radius + 2.2));
  }

  /** 엔딩 카메라가 볼 곳 — 섬과 배 사이 */
  private voyageFocus(id: IslandId): Vector3 {
    const s = this.spots.get(id);
    return s ? s.pos.clone().lerp(this.harbor(id), 0.45) : this.shipTo.clone();
  }

  private placeRing() {
    const s = this.spots.get(this.selected);
    if (!s) return;
    this.ring.position.set(s.pos.x, 0.45, s.pos.z);
    this.ring.scale.setScalar(s.radius + 1.2);
    for (const [id, tag] of this.tags) tag.element.classList.toggle('selected', id === this.selected);
    for (const [id, tag] of this.storyTags) tag.element.classList.toggle('selected', id === this.selected);
  }

  /** 다른 섬을 고르면 배가 그리로 간다 */
  select(id: IslandId) {
    if (!this.spots.has(id) || id === this.selected) return;
    this.selected = id;
    this.shipFrom.copy(this.ship.position).setY(0);
    this.shipTo.copy(this.harbor(id));
    this.sailT = prefs.calm ? 1 : 0;
    const d = this.shipTo.clone().sub(this.shipFrom);
    if (d.lengthSq() > 0.01) this.shipYaw = Math.atan2(d.x, d.z);
    this.focusTarget.copy(this.spots.get(id)!.pos);
    this.placeRing();
  }

  /** 화면 좌표(-1~1)로 섬 고르기 */
  pick(ndcX: number, ndcY: number): IslandId | null {
    this.ray.setFromCamera(new Vector2(ndcX, ndcY), this.camera);
    const hits = this.ray.intersectObjects(this.picks.map((p) => p.obj), false);
    const hit = hits[0]?.object;
    return this.picks.find((p) => p.obj === hit)?.id ?? null;
  }

  update(dt: number, _input?: InputFrame) {
    this.t += dt;
    const t = this.t;
    this.env.follow(this.focus);
    this.env.update(t);
    this.storyBooks.forEach((book, index) => {
      book.position.y = 1.2 + (prefs.calm ? 0 : Math.sin(t * 1.2 + index) * 0.12);
      book.rotation.y = prefs.calm ? 0 : Math.sin(t * 0.5 + index) * 0.1;
    });
    if (this.sailT < 1) {
      this.sailT = Math.min(1, this.sailT + dt / this.sailDur);
      const k = this.sailT < 0.5 ? 2 * this.sailT * this.sailT : 1 - (-2 * this.sailT + 2) ** 2 / 2;
      this.ship.position.lerpVectors(this.shipFrom, this.shipTo, k);
      if (this.sailT >= 1) this.trail?.points.push(this.shipTo.clone());
    } else {
      this.ship.position.x = this.shipTo.x;
      this.ship.position.z = this.shipTo.z;
    }
    const p = this.ship.position;
    p.y = this.env.waterHeight(p.x, p.z, t) * 0.5 + 0.1;
    const sailing = this.sailT < 1;
    const yaw = sailing ? this.shipYaw : this.shipYaw + Math.sin(t * 0.4) * 0.08;
    this.ship.rotation.set(Math.cos(t * 0.9) * 0.04, yaw, Math.sin(t * 1.1) * 0.05);
    this.ring.rotation.z = t * 0.6;
    (this.ring.material as MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 3) * 0.3;

    if (this.trail) {
      // 지나온 항구들 + 지금 배 자리까지 금빛 뱃길
      const attr = this.trail.line.geometry.attributes.position as BufferAttribute;
      let n = 0;
      for (const q of this.trail.points) if (n < attr.count) attr.setXYZ(n++, q.x, 0.4, q.z);
      if (sailing && n < attr.count) attr.setXYZ(n++, p.x, 0.4, p.z);
      attr.needsUpdate = true;
      this.trail.line.geometry.setDrawRange(0, n);
    }

    this.focus.lerp(this.focusTarget, Math.min(1, dt * (this.voyage ? 1.6 : 2.5)));
    const dist = this.portrait ? 1.45 : 1;
    const sway = prefs.calm ? 0 : Math.sin(t * 0.15) * 2;
    if (this.voyage) {
      // 엔딩: 배를 따라 더 낮고 가깝게 — 아래쪽 이야기책에 가리지 않게 배가 화면 위쪽에 온다
      const lead = this.portrait ? 9 : 5.5;
      this.camera.position.set(this.focus.x + sway, 11.5 * dist, this.focus.z + 14 * dist + lead);
      this.camera.lookAt(this.focus.x, 0, this.focus.z + lead);
      return;
    }
    // 아래쪽 섬 안내판에 가리지 않도록 고른 섬이 화면 위쪽에 오게 본다
    const lead = this.portrait ? 11 : 5;
    this.camera.position.set(this.focus.x + sway, 26 * dist, this.focus.z + 25 * dist + lead);
    this.camera.lookAt(this.focus.x, 0, this.focus.z + lead);
  }

  resize(w: number, h: number) {
    this.portrait = w < h;
    this.camera.aspect = w / h;
    this.camera.fov = this.portrait ? 55 : 45;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.scene.traverse((o) => {
      const el = (o as { element?: HTMLElement }).element;
      if (el instanceof HTMLElement) el.remove();
    });
    for (const g of this.owned.geos) g.dispose();
    for (const m of this.owned.mats) m.dispose();
  }

  /** 시험용: 섬 화면 위치 (-1~1) */
  screenOf(id: IslandId): { x: number; y: number } | null {
    const s = this.spots.get(id);
    if (!s) return null;
    const v = s.pos.clone().setY(1).project(this.camera);
    return { x: v.x, y: v.y };
  }

  get islandList() {
    return this.islands;
  }
}
