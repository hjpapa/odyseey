/**
 * 보스전 실행기 — BossDef(패턴)를 매 프레임 돌리고, 칼 피해·약점 퀴즈·쓰러짐을 처리한다.
 * 규칙 (contracts.ts 10장): 칼로는 체력 1까지만, 마지막 한 방은 약점 퀴즈.
 */
import { Group, Vector3, type Scene } from 'three';
import type { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { BossContext, BossDef, BossFactory, ModelId, SfxId } from '../types/contracts';
import { getModel } from '../core/models';
import { HumanoidRig } from './rig';
import { label } from './effects';
import type { Hazards } from './hazards';
import type { Hittable } from './player';

export interface BossArena {
  x: number;
  z: number;
  radius: number;
}

export interface BossHost {
  scene: Scene;
  hazards: Hazards;
  ground(x: number, z: number): number;
  playerPos(): Vector3;
  sfx(id: SfxId): void;
  shake(strength: number): void;
  burst(at: Vector3, color: string, count: number): void;
  toast(text: string): void;
  summon(model: ModelId, count: number, near: Vector3): void;
  /** 약점 퀴즈 — 첫 시도에 맞혔는지 */
  askWeak(): Promise<boolean>;
  bar(name: string | null, hp?: number, max?: number): void;
  phase(name: string): void;
  defeated(): void;
}

type Pose = 'idle' | 'walk' | 'windup' | 'strike' | 'tired';

export class BossFight implements Hittable {
  readonly root = new Group();
  readonly pos = new Vector3();
  readonly radius: number;
  readonly def: BossDef;
  alive = true;
  hp: number;
  private model: Group;
  private rig: HumanoidRig;
  private height: number;
  private target: Vector3 | null = null;
  private speed = 0;
  private lift = 0;
  private liftNow = 0;
  private heading = 0;
  private poseName: Pose = 'idle';
  private poseT = 0;
  private time = 0;
  private busy = false;
  private lastWeak = 0;
  private bubble: CSS2DObject;
  private bubbleT = 0;
  private flash = 0;
  private dying = -1;
  private meleeNoted = false;
  private ctx: BossContext;

  constructor(factory: BossFactory, readonly arena: BossArena, private host: BossHost) {
    this.def = factory();
    this.hp = this.def.maxHp;
    this.model = getModel(this.def.model);
    this.root.add(this.model);
    this.rig = new HumanoidRig(this.model);
    this.height = (this.model.userData.height as number) || 3;
    this.radius = Math.max(0.8, Math.min(2.5, ((this.model.userData.radius as number) || 1) * 0.8));
    this.pos.set(arena.x, host.ground(arena.x, arena.z), arena.z);
    this.bubble = label('', 'boss-bubble');
    this.bubble.position.y = this.height + 0.8;
    this.bubble.visible = false;
    this.root.add(this.bubble);

    const self = this;
    this.ctx = {
      get time() { return self.time; },
      get hp() { return self.hp; },
      get maxHp() { return self.def.maxHp; },
      arena: { ...arena },
      get boss() { return { x: self.pos.x, z: self.pos.z }; },
      get player() {
        const p = host.playerPos();
        return { x: p.x, z: p.z };
      },
      moveTo(x, z, speed, y = 0) {
        self.target = new Vector3(x, 0, z);
        self.speed = Math.max(0, speed);
        self.lift = y;
      },
      face(x, z) {
        self.heading = Math.atan2(x - self.pos.x, z - self.pos.z);
      },
      pose(p) {
        if (p !== self.poseName) {
          self.poseName = p;
          self.poseT = 0;
        }
      },
      telegraph(x, z, radius, delay, effect) {
        host.hazards.add(x, z, Math.min(3.5, Math.max(1.2, radius)), Math.max(0.9, delay), effect);
      },
      summon(model, count) {
        host.summon(model, Math.min(4, Math.max(0, Math.floor(count))), self.pos);
      },
      weak() {
        void self.weakPhase();
      },
      say(text) {
        self.say(text);
      },
      sfx(id) {
        host.sfx(id);
      },
      shake(s) {
        host.shake(s);
      },
      phase(name) {
        host.phase(name);
      },
    };
    this.sync();
  }

  start() {
    this.host.bar(this.def.name, this.hp, this.def.maxHp);
    this.host.sfx('boss_roar');
    this.host.shake(0.5);
    this.def.start?.(this.ctx);
  }

  update(dt: number, frozen: boolean) {
    this.bubbleT -= dt;
    if (this.bubbleT <= 0) this.bubble.visible = false;
    if (this.dying >= 0) {
      this.dying += dt;
      this.root.scale.setScalar(Math.max(0.01, 1 - this.dying / 0.7));
      if (this.dying >= 0.7) {
        this.bubble.element.remove();
        this.root.removeFromParent();
      }
      return;
    }
    this.flash -= dt;
    const p = this.host.playerPos();
    const away = Math.hypot(p.x - this.arena.x, p.z - this.arena.z) > this.arena.radius * 2.2;
    const acting = !frozen && !this.busy && !away;
    if (acting) {
      this.time += dt;
      this.def.update(this.ctx, dt);
      // 체력이 1에서 오래 멈춰 있으면 약점 퀴즈로 마무리
      if (this.hp <= 1 && this.time - this.lastWeak > 3) void this.weakPhase();
    }
    if (this.target && acting) {
      const dx = this.target.x - this.pos.x;
      const dz = this.target.z - this.pos.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.05 && this.speed > 0) {
        const step = Math.min(len, this.speed * dt);
        this.pos.x += (dx / len) * step;
        this.pos.z += (dz / len) * step;
      }
      const ax = this.pos.x - this.arena.x;
      const az = this.pos.z - this.arena.z;
      const al = Math.hypot(ax, az);
      if (al > this.arena.radius) {
        this.pos.x = this.arena.x + (ax / al) * this.arena.radius;
        this.pos.z = this.arena.z + (az / al) * this.arena.radius;
      }
    }
    this.liftNow += (this.lift - this.liftNow) * Math.min(1, dt * 3);
    this.pos.y = this.host.ground(this.pos.x, this.pos.z) + this.liftNow;
    this.poseT += dt;
    const pose = this.busy ? 'tired' : this.poseName;
    this.rig.update(dt, {
      speed: pose === 'walk' && acting ? 0.6 : 0,
      grounded: true,
      swing: pose === 'strike' ? Math.min(1, this.poseT / 0.3) : null,
      combo: 0,
      windup: pose === 'windup' ? Math.min(1, this.poseT * 2) : 0,
      tired: pose === 'tired',
    });
    this.model.visible = this.flash <= 0 || Math.floor(this.flash * 30) % 2 === 0;
    this.sync();
  }

  /** 플레이어의 칼에 맞음 */
  hit(dmg: number, _from: Vector3) {
    if (!this.alive || this.busy || this.dying >= 0) return;
    if (!this.def.melee) {
      if (!this.meleeNoted) {
        this.meleeNoted = true;
        this.host.toast('칼이 닿지 않아요! 약점이 보일 때를 기다려요 ⚡');
      }
      return;
    }
    if (this.hp <= 1) {
      this.host.sfx('shield_block');
      return;
    }
    this.hp = Math.max(1, this.hp - dmg);
    this.flash = 0.25;
    this.host.sfx('boss_hit');
    this.host.bar(this.def.name, this.hp, this.def.maxHp);
  }

  /** 이 보스전을 그만둔다 (장면을 떠날 때) */
  dispose() {
    this.bubble.element.remove();
    this.root.removeFromParent();
  }

  private say(text: string) {
    this.bubble.element.textContent = text;
    this.bubble.visible = true;
    this.bubbleT = 2.6;
  }

  private async weakPhase() {
    if (this.busy || !this.alive) return;
    this.busy = true;
    this.host.hazards.clear();
    this.host.sfx('magic');
    this.host.toast('⚡ 약점이 보여요! 문제를 맞혀 공격해요!');
    const firstTry = await this.host.askWeak();
    if (!this.alive) return;
    const dmg = firstTry ? this.def.quizDamage : Math.ceil(this.def.quizDamage / 2);
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 0.4;
    this.host.sfx('boss_hit');
    this.host.shake(0.6);
    this.host.burst(this.pos.clone().setY(this.pos.y + this.height * 0.6), '#ffe066', 30);
    this.host.bar(this.def.name, this.hp, this.def.maxHp);
    this.lastWeak = this.time;
    this.busy = false;
    this.poseName = 'idle';
    if (this.hp <= 0) this.defeat();
  }

  private defeat() {
    this.alive = false;
    this.dying = 0;
    this.host.hazards.clear();
    this.host.sfx('boss_defeat');
    this.host.shake(0.8);
    this.host.burst(this.pos.clone().setY(this.pos.y + this.height * 0.5), '#ffe066', 60);
    this.host.bar(null);
    this.host.defeated();
  }

  private sync() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.heading;
  }
}
