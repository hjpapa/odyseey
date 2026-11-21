/**
 * 엔딩 장면 — 잔치가 끝난 저녁의 이타카.
 * 바닷가에서 노을을 보던 오디세우스에게 가족이 언덕을 내려와 이야기를 나누고,
 * 아테나 부엉이가 날아오면 모험에서 만난 친구들이 하나둘 나타나 별가루 불꽃 아래에서 함께 손을 흔든다.
 * 대사는 대화창으로 보여 주고(가만히 있어도 넘어감), 카메라는 말하는 사람을 따라간다.
 * 건너뛰면 곧바로 모두 모인 마지막 모습이 된다. 크레딧도 이 장면 위로 올라간다.
 */
import { Group, type Object3D, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { AvatarCustomization, ModelId, SfxId, SpeakerId } from '../types/contracts';
import type { InputFrame } from '../core/input';
import type { DialogueUI } from '../ui/dialogue';
import { getModel } from '../core/models';
import { createEnvironment, type Environment } from '../world/environment';
import { makeProp } from '../world/props';
import { createRig, type CreatureRig, type HumanoidRig } from '../play/rig';
import { Effects } from '../play/effects';
import { buildClouds, buildIsland } from './titleStage';
import { prefs } from './prefs';
import type { Stage } from './services';

const FIREWORK = ['#ffe066', '#ff8fb1', '#8fd3ff', '#b7f28f', '#ffffff'];
/** 바다(＋x) 쪽을 보는 방향 */
const SEA = Math.PI / 2;

export type Cast = 'odysseus' | 'penelope' | 'telemachus' | 'dog' | 'eumaeus' | 'nausicaa' | 'hermes' | 'calypso' | 'aeolus' | 'ino';

/** 가족 — 처음부터 있다 */
const FAMILY: Cast[] = ['odysseus', 'penelope', 'telemachus', 'dog'];
/** 친구들 — 부엉이가 부르면 하나씩 나타난다 (크레딧의 '도와준 친구들'과 같은 얼굴) */
export const FRIENDS: Cast[] = ['eumaeus', 'nausicaa', 'hermes', 'calypso', 'aeolus', 'ino'];

/** 마지막에 모두 모이는 자리 [x, z] — 앞줄은 바닷가, 뒷줄 친구들은 한 칸 높은 언덕 */
export const FINAL_SPOT: Record<Cast, [number, number]> = {
  odysseus: [12.4, -1.0],
  penelope: [12.6, 0.4],
  telemachus: [12.3, 1.7],
  dog: [13.5, 0.2],
  eumaeus: [11.0, -2.6],
  nausicaa: [10.9, 3.1],
  hermes: [9.9, -1.6],
  calypso: [9.8, 1.0],
  aeolus: [10.3, -3.9],
  ino: [10.2, 4.3],
};

interface Actor {
  id: Cast;
  model: Object3D;
  rig: HumanoidRig | CreatureRig;
  /** 땅 위 자리 (y 는 계단 모양 땅을 부드럽게 따라간다) */
  pos: Vector3;
  yaw: number;
  goal: Vector3 | null;
  speed: number;
  arrived: (() => void) | null;
  wave: boolean;
  hop: boolean;
}

interface Shot {
  pos: Vector3;
  look: Vector3;
}

export interface EpilogueContext {
  dialogue: DialogueUI;
  sfx(id: SfxId, volume?: number): void;
  /** 건너뛰기 — 걸리면 남은 장면을 하지 않는다 */
  signal: AbortSignal;
}

export class EndingStage implements Stage {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(50, 1, 0.1, 1200);
  private env: Environment;
  private fx: Effects;
  private clouds: Group;
  private t = 0;
  private nextFirework = 0.5;
  private fireworks = false;
  private ground: (x: number, z: number) => number;
  private actors = new Map<Cast, Actor>();
  private owl: Object3D;
  private owlRig: HumanoidRig | CreatureRig;
  private owlPos = new Vector3(3, 18, -12);
  private owlGoal: Vector3 | null = null;
  private owlCircle = false;
  private center = new Vector3(12, 1, 0.3);
  private portrait = false;
  /** 카메라: 지금 자리 → 목표 자리로 부드럽게 */
  private cam: Shot = { pos: new Vector3(), look: new Vector3() };
  private camTo: Shot = { pos: new Vector3(), look: new Vector3() };
  private camSpeed = 1.6;
  private orbit = false;
  /** 기다리는 동안 흐르는 장면 시간 (debugStep 으로도 흐른다) */
  private waits: { until: number; done: () => void }[] = [];

  constructor(avatar?: AvatarCustomization) {
    this.env = createEnvironment(this.scene, 'dusk');
    const island = buildIsland();
    this.scene.add(island.group);
    this.ground = (x, z) => island.heightAt(x, z);
    this.clouds = buildClouds();
    this.scene.add(this.clouds);
    this.fx = new Effects(this.scene);
    this.center.y = this.ground(this.center.x, this.center.z);

    const palace = makeProp('palace');
    palace.position.set(-4, this.ground(-4, -2), -2);
    palace.rotation.y = Math.PI / 2;
    this.scene.add(palace);
    for (const [x, z] of [[1.5, -4], [1.5, 2], [11, -3.4], [11, 3.6]]) {
      const torch = makeProp('torch');
      torch.position.set(x, this.ground(x, z), z);
      this.scene.add(torch);
    }
    for (const [x, z, r] of [[-2, 8, 0.4], [8, -7, 1.2], [-8, -8, 2.2], [7, 7, 0.8]]) {
      const tree = makeProp('oliveTree');
      tree.position.set(x, this.ground(x, z), z);
      tree.rotation.y = r;
      this.scene.add(tree);
    }

    // 오디세우스는 바닷가에서 노을을 보고, 가족은 궁전 앞에서 시작한다 (친구들은 제자리에 숨어 있다)
    const start: Partial<Record<Cast, [number, number]>> = { penelope: [0.6, -0.6], telemachus: [0.2, 0.8], dog: [1.2, 0.2] };
    for (const id of [...FAMILY, ...FRIENDS]) {
      const model = getModel(id as ModelId, id === 'odysseus' ? { avatar } : undefined);
      const [x, z] = start[id] ?? FINAL_SPOT[id];
      const yaw = SEA;
      const pos = new Vector3(x, this.ground(x, z), z);
      model.position.copy(pos);
      model.rotation.y = yaw;
      model.visible = FAMILY.includes(id);
      this.scene.add(model);
      this.actors.set(id, { id, model, rig: createRig(model), pos, yaw, goal: null, speed: 2.2, arrived: null, wave: false, hop: false });
    }
    this.owl = getModel('athenaOwl');
    this.owl.position.copy(this.owlPos);
    this.scene.add(this.owl);
    this.owlRig = createRig(this.owl);

    this.cut('sunset');
  }

  // ─── 연출 도구 ─────────────────────────────────────────

  /** 카메라 자리 — 이름 있는 장면이나 배우 가까이 (바다 쪽에서 본다: 언덕 쪽은 땅에 묻힌다) */
  private shotOf(name: 'sunset' | 'descend' | 'group' | 'party' | Cast): Shot {
    const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
    const c = this.center;
    switch (name) {
      case 'sunset': return { pos: v(8.6, c.y + 4.4, -2.8), look: v(22, c.y + 0.4, 1.8) };
      case 'descend': return { pos: v(21, c.y + 4.8, 3.4), look: v(6.5, c.y + 3.2, -0.2) };
      case 'group': return { pos: v(20, c.y + 3.2, 0.6), look: v(12.2, c.y + 1.5, 0.3) };
      // 모두 모인 모습 — 아래쪽 마지막 장·크레딧에 가리지 않게 모두가 화면 위쪽에 오도록 내려다본다
      case 'party': return { pos: v(24, c.y + 6, 7), look: v(13, c.y + 0.6, 1.3) };
      default: {
        const a = this.actors.get(name)!;
        const side = a.pos.z >= c.z ? 1 : -1;
        const h = name === 'dog' ? 0.7 : 1.45;
        return { pos: v(a.pos.x + 4.4, a.pos.y + h + 0.5, a.pos.z + side * 1.2), look: v(a.pos.x, a.pos.y + h, a.pos.z) };
      }
    }
  }

  /** 세로 화면이면 더 물러나서 본다 */
  private fit(s: Shot): Shot {
    if (!this.portrait) return s;
    return { pos: s.look.clone().add(s.pos.clone().sub(s.look).multiplyScalar(1.55)), look: s.look };
  }

  shot(name: Parameters<EndingStage['shotOf']>[0], speed = 1.6) {
    const s = this.fit(this.shotOf(name));
    this.camTo.pos.copy(s.pos);
    this.camTo.look.copy(s.look);
    this.camSpeed = speed;
    this.orbit = name === 'party';
  }

  /** 카메라를 바로 옮긴다 */
  cut(name: Parameters<EndingStage['shotOf']>[0]) {
    this.shot(name);
    this.cam.pos.copy(this.camTo.pos);
    this.cam.look.copy(this.camTo.look);
  }

  /** 장면 시간으로 기다리기 */
  wait(sec: number): Promise<void> {
    return new Promise((done) => this.waits.push({ until: this.t + sec, done }));
  }

  /** 그 자리까지 걸어간다 (도착하면 끝난다 — 오래 걸려도 거리만큼만 기다린다) */
  walk(id: Cast, x: number, z: number, speed = 2.2): Promise<void> {
    const a = this.actors.get(id)!;
    a.goal = new Vector3(x, 0, z);
    a.speed = speed;
    a.arrived?.();
    return new Promise((done) => (a.arrived = done));
  }

  /** 다른 배우나 방향(라디안) 쪽을 본다 */
  face(id: Cast, to: Cast | number) {
    const a = this.actors.get(id)!;
    if (typeof to === 'number') a.yaw = to;
    else {
      const b = this.actors.get(to)!;
      a.yaw = Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
    }
  }

  /** 친구가 별가루와 함께 나타난다 */
  appear(id: Cast) {
    const a = this.actors.get(id)!;
    if (a.model.visible) return;
    a.model.visible = true;
    a.wave = true;
    this.fx.burst(a.pos.clone().setY(a.pos.y + 1.2), FIREWORK[FRIENDS.indexOf(id) % FIREWORK.length], 30, 3, 3);
  }

  // ─── 이야기 ────────────────────────────────────────────

  /** 잔치가 끝난 저녁의 짧은 이야기. 건너뛰기(signal)가 걸리면 바로 멈춘다 */
  async epilogue(ctx: EpilogueContext): Promise<void> {
    const { dialogue, signal } = ctx;
    const stop = () => signal.aborted;
    const say = async (who: SpeakerId, text: string, cam?: Parameters<EndingStage['shotOf']>[0]) => {
      if (stop()) return;
      if (cam) this.shot(cam);
      await dialogue.line(who, text, undefined, { autoMs: 2600 + [...text].length * 85 });
    };

    // 1. 노을 진 바다를 보는 오디세우스
    await this.wait(1.4);
    if (stop()) return;
    await dialogue.caption('잔치가 끝난 저녁, 이타카의 바다가 노을로 물들었어요.');
    await say('odysseus', '저 바다 너머에서… 정말 많은 일이 있었지.', 'odysseus');

    // 2. 가족이 궁전에서 언덕을 내려온다 — 아르고스가 먼저 달려온다
    if (stop()) return;
    this.shot('descend', 1.2);
    const [px, pz] = FINAL_SPOT.penelope;
    const [tx, tz] = FINAL_SPOT.telemachus;
    const coming = Promise.all([
      this.walk('dog', 13.6, 0.9, 4.2),
      this.walk('penelope', px, pz, 2.1),
      this.walk('telemachus', tx - 0.4, tz + 0.3, 2.4),
    ]);
    await this.wait(1.6);
    await say('telemachus', '아버지! 여기 계셨어요?');
    await coming;
    if (stop()) return;
    this.face('odysseus', 'penelope');
    this.face('penelope', 'odysseus');
    this.face('telemachus', 'odysseus');
    this.face('dog', 'odysseus');

    // 3. 가족의 이야기
    await say('telemachus', '아버지, 모험 이야기를 또 들려주세요!', 'telemachus');
    await say('odysseus', '외눈 거인, 바람 주머니, 노래하는 세이렌… 정말 많은 일이 있었단다.', 'odysseus');
    await say('odysseus', '그래도 가장 힘들었던 건, 너희가 보고 싶었던 거야.', 'odysseus');
    await say('penelope', '이제는 어디에도 가지 말아요. 우리 가족, 늘 함께해요.', 'penelope');
    if (stop()) return;
    this.actors.get('dog')!.hop = true;
    await say('dog', '멍! 멍멍! (나도 있어요!)', 'dog');
    await say('odysseus', '하하, 그래. 아르고스도 함께!', 'group');

    // 4. 아테나 부엉이가 날아오고, 친구들이 축하하러 온다
    if (stop()) return;
    this.owlGoal = new Vector3(12.6, this.center.y + 4.6, 0.4);
    ctx.sfx('owl', 0.6);
    await this.wait(1.2);
    await say('athenaOwl', '오디세우스, 너를 도와준 친구들도 축하하러 왔어!', 'group');
    if (stop()) return;
    this.gather();
    this.shot('party', 1.1);
    for (const id of FRIENDS) {
      if (stop()) return;
      this.appear(id);
      ctx.sfx('magic', 0.45);
      await this.wait(0.45);
    }
    this.fireworks = true;
    await this.wait(1.2);
    await say('nausicaa', '오디세우스 님, 집에 돌아온 걸 축하해요!');
    await this.wait(0.8);
  }

  /** 가족이 바다(카메라) 쪽을 보고 나란히 선다 */
  private gather() {
    for (const id of FAMILY) {
      const a = this.actors.get(id)!;
      const [x, z] = FINAL_SPOT[id];
      a.goal = new Vector3(x, 0, z);
      a.speed = 2.4;
      a.wave = id !== 'dog';
    }
    this.owlCircle = true;
  }

  /** 건너뛰기·이야기 끝 — 모두 모인 마지막 모습 (크레딧이 이 위로 올라간다) */
  finale() {
    for (const [id, a] of this.actors) {
      const [x, z] = FINAL_SPOT[id];
      a.goal = null;
      a.arrived?.();
      a.arrived = null;
      a.pos.set(x, this.ground(x, z), z);
      a.yaw = SEA;
      a.model.visible = true;
      a.wave = id !== 'dog';
      a.hop = id === 'dog';
    }
    this.owlGoal = new Vector3(12.6, this.center.y + 4.6, 0.4);
    this.owlCircle = true;
    this.fireworks = true;
    this.shot('party', 0.8);
  }

  /** 시험·확인용: 배우들의 자리와 보이는지, 불꽃이 터지는지 */
  snapshot() {
    return {
      fireworks: this.fireworks,
      cast: [...this.actors.values()].map((a) => ({ id: a.id, pos: a.model.position.clone(), visible: a.model.visible })),
    };
  }

  // ─── 매 프레임 ─────────────────────────────────────────

  update(dt: number, _input?: InputFrame) {
    const calm = prefs.calm;
    this.t += dt;
    const t = this.t;
    this.env.follow(this.center);
    this.env.update(t);
    this.fx.update(dt);
    this.clouds.rotation.y = t * 0.004;

    for (let i = this.waits.length - 1; i >= 0; i--) {
      if (this.t >= this.waits[i].until) {
        const w = this.waits.splice(i, 1)[0];
        w.done();
      }
    }

    for (const a of this.actors.values()) {
      let speed = 0;
      if (a.goal) {
        const dx = a.goal.x - a.pos.x;
        const dz = a.goal.z - a.pos.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.06) {
          a.goal = null;
          const done = a.arrived;
          a.arrived = null;
          done?.();
        } else {
          const step = Math.min(len, a.speed * dt);
          a.pos.x += (dx / len) * step;
          a.pos.z += (dz / len) * step;
          a.yaw = turn(a.yaw, Math.atan2(dx, dz), dt * 9);
          speed = Math.min(1, a.speed / 3);
        }
      } else if (this.fireworks) a.yaw = turn(a.yaw, SEA, dt * 4);
      // 계단 모양 땅을 오르내릴 때 툭툭 끊기지 않게
      a.pos.y += (this.ground(a.pos.x, a.pos.z) - a.pos.y) * Math.min(1, dt * 10);
      const hop = a.hop && !calm ? Math.abs(Math.sin(t * 6)) * 0.3 : 0;
      a.model.position.set(a.pos.x, a.pos.y + hop, a.pos.z);
      a.model.rotation.y = a.yaw;
      a.rig.update(dt, { speed: a.hop ? Math.max(speed, 0.3) : speed, grounded: true, swing: null, combo: 0, wave: a.wave && Math.sin(t * 0.9 + a.pos.z) > -0.3 });
    }

    // 부엉이: 하늘에서 내려와 가족 위를 맴돈다
    if (this.owlGoal) {
      const goal = this.owlCircle
        ? new Vector3(this.owlGoal.x + Math.cos(t * 0.7) * 2.4, this.owlGoal.y + Math.sin(t * 1.3) * 0.3, this.owlGoal.z + Math.sin(t * 0.7) * 2.4)
        : this.owlGoal;
      const prev = this.owlPos.clone();
      this.owlPos.lerp(goal, Math.min(1, dt * 1.6));
      const v = this.owlPos.clone().sub(prev);
      if (v.lengthSq() > 1e-6) this.owl.rotation.y = Math.atan2(v.x, v.z);
    }
    this.owl.position.copy(this.owlPos);
    this.owl.position.y += Math.sin(t * 2.4) * 0.15;
    this.owlRig.update(dt, { speed: 1, grounded: false, swing: null, combo: 0 });

    // 별가루 불꽃 — 모두의 머리 위 하늘
    if (this.fireworks && !calm) {
      this.nextFirework -= dt;
      if (this.nextFirework <= 0) {
        this.nextFirework = 0.7 + Math.random() * 0.7;
        const at = new Vector3(6.5 + Math.random() * 4, this.center.y + 4 + Math.random() * 1.8, -4.5 + Math.random() * 9);
        this.fx.burst(at, FIREWORK[Math.floor(Math.random() * FIREWORK.length)], 50, 4.5, 2);
      }
    }

    // 카메라
    if (this.orbit) {
      // 모두 모인 뒤에는 천천히 좌우로 돈다
      const base = this.fit(this.shotOf('party'));
      const off = base.pos.clone().sub(base.look);
      off.applyAxisAngle(new Vector3(0, 1, 0), calm ? 0 : Math.sin(t * 0.09) * 0.32);
      this.camTo.pos.copy(base.look).add(off);
      this.camTo.look.copy(base.look);
    }
    const k = 1 - Math.exp(-this.camSpeed * dt);
    this.cam.pos.lerp(this.camTo.pos, k);
    this.cam.look.lerp(this.camTo.look, k);
    this.camera.position.copy(this.cam.pos);
    this.camera.lookAt(this.cam.look);
  }

  resize(w: number, h: number) {
    const was = this.portrait;
    this.portrait = w < h;
    this.camera.aspect = w / h;
    this.camera.fov = this.portrait ? 60 : 50;
    this.camera.updateProjectionMatrix();
    if (was !== this.portrait) {
      // 화면을 돌리면 지금 장면을 새 비율로 다시 잡는다
      const back = 1.55;
      const scale = this.portrait ? back : 1 / back;
      for (const s of [this.cam, this.camTo]) s.pos.sub(s.look).multiplyScalar(scale).add(s.look);
    }
  }

  dispose() {
    for (const w of this.waits) w.done();
    this.waits = [];
    for (const a of this.actors.values()) a.arrived?.();
    this.fx.dispose();
    // 3D 이름표(CSS2D)가 있으면 화면에서 뗀다
    this.scene.traverse((o) => (o as { element?: { remove?(): void } }).element?.remove?.());
  }
}

/** 각도를 가장 가까운 쪽으로 조금씩 돌린다 */
function turn(from: number, to: number, k: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * Math.min(1, k);
}
