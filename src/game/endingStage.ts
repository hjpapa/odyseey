/**
 * 엔딩 장면 — 노을 진 이타카, 궁전 앞에 모인 오디세우스 가족과 충성스러운 개.
 * 하늘에는 별가루 불꽃이 터지고, 카메라는 천천히 가족 둘레를 돈다.
 */
import { Group, type Object3D, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { AvatarCustomization, ModelId } from '../types/contracts';
import type { InputFrame } from '../core/input';
import { getModel } from '../core/models';
import { createEnvironment, type Environment } from '../world/environment';
import { makeProp } from '../world/props';
import { createRig, type CreatureRig, type HumanoidRig } from '../play/rig';
import { Effects } from '../play/effects';
import { buildClouds, buildIsland } from './titleStage';
import type { Stage } from './services';

const FIREWORK = ['#ffe066', '#ff8fb1', '#8fd3ff', '#b7f28f', '#ffffff'];

export class EndingStage implements Stage {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(50, 1, 0.1, 1200);
  private env: Environment;
  private fx: Effects;
  private clouds: Group;
  private t = 0;
  private nextFirework = 1;
  private actors: { model: Object3D; rig: HumanoidRig | CreatureRig; wave?: boolean; hop?: boolean; baseY: number }[] = [];
  private center = new Vector3(4, 0, 0);
  private portrait = false;
  private reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor(avatar?: AvatarCustomization) {
    this.env = createEnvironment(this.scene, 'dusk');
    const island = buildIsland();
    this.scene.add(island.group);
    this.clouds = buildClouds();
    this.scene.add(this.clouds);
    this.fx = new Effects(this.scene);

    const ground = (x: number, z: number) => island.heightAt(x, z);
    this.center.y = ground(this.center.x, this.center.z);

    const palace = makeProp('palace');
    palace.position.set(-4, ground(-4, -2), -2);
    palace.rotation.y = Math.PI / 2;
    this.scene.add(palace);
    for (const [x, z] of [[1, -4], [1, 4], [8, -3.5], [8, 3.5]]) {
      const torch = makeProp('torch');
      torch.position.set(x, ground(x, z), z);
      this.scene.add(torch);
    }
    for (const [x, z, r] of [[-2, 8, 0.4], [10, -7, 1.2], [-8, -8, 2.2]]) {
      const tree = makeProp('oliveTree');
      tree.position.set(x, ground(x, z), z);
      tree.rotation.y = r;
      this.scene.add(tree);
    }

    const family: { id: ModelId; x: number; z: number; wave?: boolean; hop?: boolean }[] = [
      { id: 'odysseus', x: 4, z: -1.3, wave: true },
      { id: 'penelope', x: 4, z: 0.2 },
      { id: 'telemachus', x: 4.6, z: 1.6, wave: true },
      { id: 'dog', x: 6, z: 0.4, hop: true },
    ];
    for (const p of family) {
      const model = getModel(p.id, p.id === 'odysseus' ? { avatar } : undefined);
      const y = ground(p.x, p.z);
      model.position.set(p.x, y, p.z);
      model.rotation.y = Math.PI / 2; // 바다(＋x) 쪽을 본다
      this.scene.add(model);
      this.actors.push({ model, rig: createRig(model), wave: p.wave, hop: p.hop, baseY: y });
    }
    const owl = getModel('athenaOwl');
    owl.position.set(5, this.center.y + 4.5, -0.5);
    this.scene.add(owl);
    this.actors.push({ model: owl, rig: createRig(owl), baseY: owl.position.y });
  }

  update(dt: number, _input?: InputFrame) {
    this.t += dt * (this.reduceMotion ? 0.4 : 1);
    const t = this.t;
    this.env.follow(this.center);
    this.env.update(t);
    this.fx.update(dt);
    this.clouds.rotation.y = t * 0.004;

    for (const a of this.actors) {
      const flying = a.model.userData.modelId === 'athenaOwl';
      if (flying) {
        a.model.position.set(this.center.x + Math.cos(t * 0.5) * 3, a.baseY + Math.sin(t * 1.3) * 0.4, this.center.z + Math.sin(t * 0.5) * 3);
        a.model.rotation.y = -t * 0.5;
      }
      if (a.hop) a.model.position.y = a.baseY + Math.abs(Math.sin(t * 5)) * 0.25;
      a.rig.update(dt, { speed: flying ? 1 : a.hop ? 0.3 : 0, grounded: !flying, swing: null, combo: 0, wave: a.wave && Math.sin(t * 0.7) > -0.2 });
    }

    // 별가루 불꽃
    this.nextFirework -= dt;
    if (this.nextFirework <= 0 && !this.reduceMotion) {
      this.nextFirework = 0.9 + Math.random() * 0.8;
      const at = new Vector3(this.center.x + 10 + Math.random() * 14, this.center.y + 9 + Math.random() * 6, this.center.z - 12 + Math.random() * 24);
      this.fx.burst(at, FIREWORK[Math.floor(Math.random() * FIREWORK.length)], 60, 7, 2);
    }

    const a = 0.25 + Math.sin(t * 0.08) * 0.55;
    const r = this.portrait ? 20 : 14;
    this.camera.position.set(this.center.x + Math.cos(a) * r, this.center.y + 4.5 + Math.sin(t * 0.12) * 0.6, this.center.z + Math.sin(a) * r);
    this.camera.lookAt(this.center.x, this.center.y + 2.2, this.center.z);
  }

  resize(w: number, h: number) {
    this.portrait = w < h;
    this.camera.aspect = w / h;
    this.camera.fov = this.portrait ? 62 : 50;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.fx.dispose();
    this.scene.traverse((o) => {
      const el = (o as { element?: HTMLElement }).element;
      if (el instanceof HTMLElement) el.remove();
    });
  }
}
