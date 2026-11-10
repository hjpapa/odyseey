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

function buildIsland() {
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

    this.hero = getModel('odysseus', { avatar });
    this.heroY = island.heightAt(13.6, 2.2);
    this.hero.position.set(13.6, this.heroY, 2.2);
    this.hero.rotation.y = Math.PI / 2 + 0.35;
    this.hero.getObjectByName('handR')?.add(makeProp('sword'));
    this.scene.add(this.hero);
    this.heroRig = new HumanoidRig(this.hero);
    this.heroHead = this.hero.getObjectByName('head');

    const cal = getModel('calypso');
    cal.position.set(8.5, island.heightAt(8.5, -1.2), -1.2);
    cal.rotation.y = Math.PI / 2 + 0.9;
    this.scene.add(cal);
    this.calRig = new HumanoidRig(cal);
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
    this.camera.position.set(this.focus.x + Math.cos(a) * r, 10 + Math.sin(t * 0.1) * 1.2, this.focus.z + Math.sin(a) * r);
    this.camera.lookAt(this.focus);
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 62 : 50;
    this.camera.updateProjectionMatrix();
  }

  dispose() {}
}
