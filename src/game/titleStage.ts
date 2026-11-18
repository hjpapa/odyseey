/** 타이틀 화면 배경 — 칼립소의 섬 해변, 뗏목, 손 흔드는 칼립소 */
import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, type Object3D, PerspectiveCamera, Quaternion, Scene, Vector3 } from 'three';
import type { AvatarCustomization } from '../types/contracts';
import type { InputFrame } from '../core/input';
import { getModel } from '../core/models';
import { block, toonMaterial } from '../core/placeholders';
import { createEnvironment, type Environment } from '../world/environment';
import { makeProp } from '../world/props';
import { HumanoidRig } from '../play/rig';
import type { Stage } from './services';

const CELL = 1.5;
const SEA_FLOOR = -4;
/** 해변의 오디세우스가 바다(뗏목) 쪽을 보는 방향 */
const HERO_YAW = Math.PI / 2 + 0.35;

export function buildIsland() {
  type Cell = { x: number; z: number; h: number };
  const kinds = { sand: [] as Cell[], grass: [] as Cell[], rock: [] as Cell[] };
  const heights = new Map<string, number>();
  for (let ix = -13; ix <= 13; ix++) {
    for (let iz = -13; iz <= 13; iz++) {
      const x = ix * CELL;
      const z = iz * CELL;
      const n = Math.sin(x * 0.31 + 1.3) * Math.cos(z * 0.27 - 0.4) * 0.8 + Math.sin((x - z) * 0.17) * 0.5;
      const edge = 15 + n * 2;
      const d = Math.hypot(x, z * 1.15);
      if (d > edge) continue;
      const t = 1 - d / edge;
      const h = Math.max(1, Math.round((0.9 + t * t * 7 + n * 0.8) * 2) / 2);
      kinds[t < 0.24 ? 'sand' : h >= 5 ? 'rock' : 'grass'].push({ x, z, h });
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
    const inst = new InstancedMesh(geo, toonMaterial(colors[kind]), cells.length);
    cells.forEach((c, i) => {
      inst.setMatrixAt(i, m.compose(new Vector3(c.x, (c.h + SEA_FLOOR) / 2, c.z), q, new Vector3(CELL, c.h - SEA_FLOOR, CELL)));
      const v = 0.9 + ((i * 7919) % 11) / 100;
      inst.setColorAt(i, tint.setRGB(v, v, v));
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    group.add(inst);
  }
  return { group, heightAt: (x: number, z: number) => heights.get(`${Math.round(x / CELL)},${Math.round(z / CELL)}`) ?? 0 };
}

export function buildClouds(): Group {
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

export class TitleStage implements Stage {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(50, 1, 0.1, 1200);
  private env: Environment;
  private t = 0;
  private raft: Group;
  private clouds: Group;
  private hero: Group;
  private heroY: number;
  private heroRig: HumanoidRig;
  private calRig: HumanoidRig;
  private heroHead: Object3D | undefined;
  private focus = new Vector3(9, 5.2, 0.5);
  private reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  private view = { w: 1, h: 1 };
  /** 꾸미기 중: 화면 위쪽에서 비어 있는 비율(0~1)을 알려 주는 함수 — 그 안에 오디세우스를 크게 담는다 */
  private closeUp: (() => number) | null = null;
  private closeK = 0;
  private freeTop = 0.45;
  /** 꾸미기 중 천천히 도는 각도 (등의 망토도 보이게) */
  private spin = 0;

  constructor(avatar?: AvatarCustomization) {
    this.env = createEnvironment(this.scene, 'day');
    const island = buildIsland();
    this.scene.add(island.group);
    this.clouds = buildClouds();
    this.scene.add(this.clouds);
    for (const [x, z, rot, s] of [[-4, -6, 0.6, 1], [2, -9, -1.1, 0.9], [-9, 2, 0.3, 1.1], [7, 7, 1.4, 1], [-3, 9, -0.8, 0.95]]) {
      const p = makeProp('palmTree');
      p.position.set(x, island.heightAt(x, z), z);
      p.rotation.y = rot;
      p.scale.setScalar(s);
      this.scene.add(p);
    }
    this.raft = makeProp('raft');
    this.raft.position.set(18.5, 0, 2.5);
    this.scene.add(this.raft);

    this.heroY = island.heightAt(13.6, 2.2);
    this.hero = this.buildHero(avatar);
    this.heroRig = new HumanoidRig(this.hero);
    this.heroHead = this.hero.getObjectByName('head');

    const cal = getModel('calypso');
    cal.position.set(8.5, island.heightAt(8.5, -1.2), -1.2);
    cal.rotation.y = Math.PI / 2 + 0.9;
    this.scene.add(cal);
    this.calRig = new HumanoidRig(cal);
  }

  private buildHero(avatar?: AvatarCustomization): Group {
    const hero = getModel('odysseus', { avatar });
    hero.position.set(13.6, this.heroY, 2.2);
    hero.rotation.y = HERO_YAW;
    hero.getObjectByName('handR')?.add(makeProp('sword'));
    // 꾸미기 미리보기에서 방패 색도 보이게 (플레이 중과 같은 자리)
    const shield = makeProp('shield', { avatar });
    shield.position.x = 0.12;
    hero.getObjectByName('handL')?.add(shield);
    this.scene.add(hero);
    return hero;
  }

  /**
   * 꾸미기 미리보기 — 카메라가 오디세우스 앞으로 다가가, 아래 카드에 가리지 않는 위쪽 빈 곳에 크게 담는다.
   * freeTop(): 화면 높이 중 위에서부터 비어 있는 비율. null 이면 원래 궤도 카메라로 돌아간다.
   */
  setCloseUp(freeTop: (() => number) | null) {
    this.closeUp = freeTop;
  }

  /** 꾸미기에서 옷을 바꾸면 해변의 오디세우스를 새 모습으로 */
  setAvatar(avatar: AvatarCustomization) {
    this.hero.removeFromParent();
    this.hero = this.buildHero(avatar);
    this.heroRig = new HumanoidRig(this.hero);
    this.heroHead = this.hero.getObjectByName('head');
  }

  update(dt: number, _input?: InputFrame) {
    this.t += dt * (this.reduceMotion ? 0.3 : 1);
    const t = this.t;
    this.env.follow(new Vector3(10, 0, 0));
    this.env.update(t);
    this.raft.position.y = this.env.waterHeight(this.raft.position.x, this.raft.position.z, t) + 0.05;
    this.raft.rotation.z = Math.sin(t * 1.1) * 0.05;
    this.raft.rotation.x = Math.cos(t * 0.9) * 0.04;
    this.heroRig.update(dt, { speed: 0, grounded: true, swing: null, combo: 0 });
    if (this.heroHead) this.heroHead.rotation.y = Math.sin(t * 0.5) * 0.35;
    this.hero.position.y = this.heroY + Math.abs(Math.sin(t * 1.6)) * 0.02;
    this.calRig.update(dt, { speed: 0, grounded: true, swing: null, combo: 0, wave: true });
    this.clouds.rotation.y = t * 0.004;
    const a = 0.62 + Math.sin(t * 0.06) * 0.35;
    const r = this.camera.aspect < 1 ? 34 : 27;
    const pos = new Vector3(this.focus.x + Math.cos(a) * r, 10 + Math.sin(t * 0.1) * 1.2, this.focus.z + Math.sin(a) * r);
    const look = this.focus.clone();

    // 꾸미기 미리보기: 부드럽게 다가가고(closeK 0→1), 비어 있는 위쪽 가운데에 오디세우스가 오도록 화면을 올린다
    this.closeK += ((this.closeUp ? 1 : 0) - this.closeK) * Math.min(1, dt * 5);
    if (this.closeUp) this.freeTop = Math.min(1, Math.max(0.28, this.closeUp()));
    const k = this.closeK < 0.002 ? 0 : this.closeK;
    // 미리보기 동안 제자리에서 천천히 돌아 등의 망토까지 보여 주고, 끝나면 원래 방향으로 돌아온다
    if (this.closeUp && !this.reduceMotion) this.spin = (this.spin + dt * 0.55) % (Math.PI * 2);
    if (k === 0) this.spin = 0;
    const turn = Math.atan2(Math.sin(this.spin), Math.cos(this.spin));
    this.hero.rotation.y = HERO_YAW + turn * k;
    if (k > 0) {
      const chest = new Vector3(this.hero.position.x, this.heroY + 1.1, this.hero.position.z);
      const yaw = HERO_YAW + 0.5; // 살짝 비스듬히 앞에서
      const half = Math.tan((this.camera.fov * Math.PI) / 360);
      // 키(약 2.3)가 빈 곳 높이의 80% 쯤 되는 거리
      const dist = 2.3 / (0.8 * this.freeTop) / (2 * half);
      const near = chest.clone().add(new Vector3(Math.sin(yaw) * dist, dist * 0.18, Math.cos(yaw) * dist));
      pos.lerp(near, k);
      look.lerp(chest, k);
      const { w, h } = this.view;
      this.camera.setViewOffset(w, h, 0, ((h - this.freeTop * h) / 2) * k, w, h);
    } else if (this.camera.view?.enabled) {
      this.camera.clearViewOffset();
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
  }

  resize(w: number, h: number) {
    this.view = { w, h };
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 62 : 50;
    this.camera.updateProjectionMatrix();
  }

  dispose() {}
}
