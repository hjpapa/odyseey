/**
 * 오디세우스 — 이동·점프·구르기·3단 베기. 하트 5개, 맞으면 잠깐 무적(깜빡임).
 */
import { Group, Vector3 } from 'three';
import type { AudioApi, AvatarCustomization } from '../types/contracts';
import type { InputFrame } from '../core/input';
import { getModel } from '../core/models';
import { makeProp } from '../world/props';
import type { IslandWorld } from '../world/island';
import { HumanoidRig } from './rig';
import { makeBody, stepBody, type Body } from './body';
import type { FollowCamera } from './camera';
import type { Effects } from './effects';

export interface Hittable {
  pos: Vector3;
  radius: number;
  alive: boolean;
  hit(dmg: number, from: Vector3): void;
}

const SPEED = 6.5;
const JUMP = 9.5;
const ROLL_TIME = 0.42;
const ROLL_SPEED = 11;
const SWINGS = [
  { time: 0.34, dmg: 1, range: 2.4, arc: 1.35 },
  { time: 0.34, dmg: 1, range: 2.4, arc: 1.45 },
  { time: 0.52, dmg: 2, range: 2.8, arc: Math.PI },
];

export class Player {
  readonly root = new Group();
  readonly pivot = new Group();
  readonly body: Body;
  readonly model: Group;
  private rig: HumanoidRig;
  heading = 0;
  hp = 5;
  maxHp = 5;
  invuln = 0;
  /** 조작 잠금 (대화·퀴즈 중) */
  frozen = false;
  private vel = new Vector3();
  private swingT = -1;
  private combo = 0;
  private queued = false;
  private hitSet = new Set<Hittable>();
  private rollT = -1;
  private rollCd = 0;
  private rollDir = new Vector3();
  private knock = new Vector3();
  private stepT = 0;
  onDamaged: (hp: number) => void = () => {};

  constructor(avatar: AvatarCustomization, private audio: AudioApi) {
    this.model = getModel('odysseus', { avatar });
    this.model.position.y = -1;
    this.pivot.position.y = 1;
    this.pivot.add(this.model);
    this.root.add(this.pivot);
    this.rig = new HumanoidRig(this.model);
    this.model.getObjectByName('handR')?.add(makeProp('sword'));
    const shield = makeProp('shield');
    shield.position.x = 0.12;
    this.model.getObjectByName('handL')?.add(shield);
    this.body = makeBody(0, 0, 0, 0.45);
  }

  get pos() {
    return this.body.pos;
  }

  get attacking() {
    return this.swingT >= 0;
  }

  get rolling() {
    return this.rollT >= 0;
  }

  /** 순간이동 (시작점·체크포인트) */
  place(x: number, y: number, z: number, heading = this.heading) {
    this.body.pos.set(x, y, z);
    this.body.vy = 0;
    this.body.grounded = true;
    this.heading = heading;
    this.vel.set(0, 0, 0);
    this.sync();
  }

  heal() {
    this.hp = this.maxHp;
  }

  update(dt: number, input: InputFrame, cam: FollowCamera, world: IslandWorld, targets: Hittable[], fx: Effects): void {
    this.invuln = Math.max(0, this.invuln - dt);
    this.rollCd = Math.max(0, this.rollCd - dt);
    const f = this.frozen ? null : input;

    // 이동 방향 (카메라 기준)
    const move = new Vector3();
    if (f) {
      move.addScaledVector(cam.forward(), f.moveY).addScaledVector(cam.right(), f.moveX);
      if (move.lengthSq() > 1) move.normalize();
    }

    // 구르기
    if (f?.roll && this.rollT < 0 && this.rollCd <= 0 && this.body.grounded) {
      this.rollT = 0;
      this.swingT = -1;
      this.rollDir.copy(move.lengthSq() > 0.01 ? move : new Vector3(Math.sin(this.heading), 0, Math.cos(this.heading))).normalize();
      this.heading = Math.atan2(this.rollDir.x, this.rollDir.z);
      this.audio.sfx('roll');
    }
    // 공격
    if (f?.attack && this.rollT < 0) {
      if (this.swingT < 0) this.startSwing(0, targets);
      else this.queued = true;
    }
    // 점프
    if (f?.jump && this.body.grounded && this.rollT < 0) {
      this.body.vy = JUMP;
      this.body.grounded = false;
      this.audio.sfx('jump');
    }

    let dx = 0;
    let dz = 0;
    if (this.rollT >= 0) {
      this.rollT += dt;
      dx = this.rollDir.x * ROLL_SPEED * dt;
      dz = this.rollDir.z * ROLL_SPEED * dt;
      this.pivot.rotation.x = Math.min(1, this.rollT / ROLL_TIME) * Math.PI * 2;
      if (this.rollT >= ROLL_TIME) {
        this.rollT = -1;
        this.rollCd = 0.25;
        this.pivot.rotation.x = 0;
      }
    } else {
      const speedMul = this.swingT >= 0 ? 0.25 : 1;
      const want = move.clone().multiplyScalar(SPEED * speedMul);
      this.vel.lerp(want, 1 - Math.exp(-dt * 14));
      dx = this.vel.x * dt;
      dz = this.vel.z * dt;
      if (move.lengthSq() > 0.01 && this.swingT < 0) {
        const target = Math.atan2(move.x, move.z);
        let diff = target - this.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.heading += diff * Math.min(1, dt * 14);
      }
    }
    if (this.knock.lengthSq() > 0.01) {
      dx += this.knock.x * dt;
      dz += this.knock.z * dt;
      this.knock.multiplyScalar(Math.exp(-dt * 8));
    }

    const landed = stepBody(this.body, dx, dz, dt, world);
    if (landed) this.audio.sfx('land');

    // 휘두르기 진행과 맞히기
    let swing: number | null = null;
    if (this.swingT >= 0) {
      const s = SWINGS[this.combo];
      this.swingT += dt;
      swing = this.swingT / s.time;
      if (swing > 0.2 && swing < 0.8) this.applyHits(targets, fx);
      if (swing >= 1) {
        if (this.queued && this.combo < 2) this.startSwing(this.combo + 1, targets);
        else {
          this.swingT = -1;
          this.combo = 0;
          swing = null;
        }
        this.queued = false;
      }
    }

    // 발소리
    const speed = Math.hypot(this.vel.x, this.vel.z) / SPEED;
    if (this.body.grounded && speed > 0.3 && this.rollT < 0) {
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.32;
        this.audio.sfx(this.body.pos.y <= 1.05 ? 'step_sand' : 'step_grass', { volume: 0.5 });
      }
    }

    const { bodyYaw } = this.rig.update(dt, {
      speed: this.rollT >= 0 ? 0 : Math.min(1, speed),
      grounded: this.body.grounded,
      swing,
      combo: this.combo,
    });
    this.sync(bodyYaw);
    // 무적 깜빡임
    this.model.visible = this.invuln <= 0 || Math.floor(this.invuln * 12) % 2 === 0;
  }

  /** 맞음 — 구르는 중이거나 무적이면 무시. 실제로 맞았으면 true */
  damage(n: number, from: Vector3): boolean {
    if (this.invuln > 0 || this.rollT >= 0 || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - n);
    this.invuln = 1.2;
    const away = this.body.pos.clone().sub(from).setY(0);
    if (away.lengthSq() < 0.0001) away.set(0, 0, 1);
    this.knock.copy(away.normalize().multiplyScalar(9));
    this.swingT = -1;
    this.audio.sfx('player_hurt');
    this.onDamaged(this.hp);
    return true;
  }

  private startSwing(combo: number, targets: Hittable[]) {
    this.combo = combo;
    this.swingT = 0;
    this.hitSet.clear();
    // 가까운 적 쪽으로 살짝 돌아서기 (아이용 자동 조준)
    let best: Hittable | null = null;
    let bestD = 4.5;
    for (const t of targets) {
      if (!t.alive) continue;
      const d = t.pos.distanceTo(this.body.pos);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (best) this.heading = Math.atan2(best.pos.x - this.body.pos.x, best.pos.z - this.body.pos.z);
    this.audio.sfx('sword_swing', { pitch: 1 + combo * 0.12 });
  }

  private applyHits(targets: Hittable[], fx: Effects) {
    const s = SWINGS[this.combo];
    const fwd = new Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    for (const t of targets) {
      if (!t.alive || this.hitSet.has(t)) continue;
      const to = t.pos.clone().sub(this.body.pos).setY(0);
      const d = to.length();
      if (d > s.range + t.radius) continue;
      if (Math.abs(t.pos.y - this.body.pos.y) > 2.5) continue;
      const ang = d < 0.01 ? 0 : fwd.angleTo(to.normalize());
      if (ang > s.arc) continue;
      this.hitSet.add(t);
      t.hit(s.dmg, this.body.pos);
      fx.burst(t.pos.clone().setY(t.pos.y + 1.2), '#ffffff', 8, 4, 2);
      this.audio.sfx('sword_hit');
    }
  }

  private sync(bodyYaw = 0) {
    this.root.position.copy(this.body.pos);
    this.root.rotation.y = this.heading + bodyYaw;
  }
}
