/**
 * 기본 적 — 어슬렁 → 쫓기 → '❗' 예고 후 공격 → 쉬기. 쓰러지면 별가루로 사라진다.
 * 아이용: 예고 시간이 길고, 한 번에 하트 1개만.
 */
import { Group, Mesh, MeshToonMaterial, Vector3 } from 'three';
import type { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { AudioApi, ModelId } from '../types/contracts';
import { getModel } from '../core/models';
import type { IslandWorld } from '../world/island';
import { HumanoidRig } from './rig';
import { makeBody, stepBody, type Body } from './body';
import type { Effects } from './effects';
import { label } from './effects';
import type { Hittable, Player } from './player';

export interface EnemySpec {
  model: ModelId;
  hp: number;
  speed: number;
  damage: number;
  aggro: number;
  windup: number;
  /** 헤르메스의 연습 그림자처럼 반투명 보라색으로 */
  shadow?: boolean;
  variant?: number;
}

type State = 'idle' | 'chase' | 'windup' | 'strike' | 'recover' | 'hurt' | 'dead';

const shadowMaterial = new MeshToonMaterial({ color: '#5b4b9a', transparent: true, opacity: 0.82, emissive: '#2a1f55' });

export class Enemy implements Hittable {
  readonly root = new Group();
  readonly body: Body;
  readonly radius = 0.5;
  alive = true;
  hp: number;
  private model: Group;
  private rig: HumanoidRig;
  private state: State = 'idle';
  private timer = 0;
  private heading = Math.random() * Math.PI * 2;
  private wander = new Vector3();
  private knock = new Vector3();
  private alert: CSS2DObject;
  private flash = 0;
  onDefeated: (e: Enemy) => void = () => {};

  constructor(readonly group: string, readonly spec: EnemySpec, home: Vector3, private audio: AudioApi) {
    this.hp = spec.hp;
    this.model = getModel(spec.model, { variant: spec.variant });
    if (spec.shadow) {
      this.model.traverse((o) => {
        if (o instanceof Mesh) {
          o.material = shadowMaterial;
          o.castShadow = false;
        }
      });
    }
    this.root.add(this.model);
    this.rig = new HumanoidRig(this.model);
    this.body = makeBody(home.x, home.y, home.z, this.radius);
    this.wander.copy(home);
    this.alert = label('❗', 'alert-mark');
    this.alert.position.y = 2.6;
    this.alert.visible = false;
    this.root.add(this.alert);
    this.sync();
  }

  get pos() {
    return this.body.pos;
  }

  hit(dmg: number, from: Vector3) {
    if (!this.alive) return;
    this.hp -= dmg;
    const away = this.body.pos.clone().sub(from).setY(0).normalize();
    this.knock.copy(away.multiplyScalar(dmg > 1 ? 13 : 8));
    this.flash = 0.25;
    this.audio.sfx('enemy_hurt');
    if (this.hp <= 0) {
      this.alive = false;
      this.state = 'dead';
      this.timer = 0.35;
      this.alert.visible = false;
      this.audio.sfx('enemy_defeat');
      return;
    }
    this.state = 'hurt';
    this.timer = 0.35;
    this.alert.visible = false;
  }

  update(dt: number, player: Player, world: IslandWorld, others: Enemy[], fx: Effects, frozen: boolean) {
    const s = this.spec;
    const toPlayer = player.pos.clone().sub(this.body.pos).setY(0);
    const dist = toPlayer.length();
    let move = new Vector3();
    let speed = 0;
    this.timer -= dt;
    this.flash -= dt;

    if (this.state === 'dead') {
      const k = Math.max(0, this.timer / 0.35);
      this.root.scale.setScalar(0.2 + 0.8 * k);
      if (this.timer <= 0) {
        fx.burst(this.body.pos.clone().setY(this.body.pos.y + 1), '#ffe066', 26, 6, 4);
        this.root.removeFromParent();
        this.alert.element.remove();
        this.onDefeated(this);
        this.state = 'dead';
        this.timer = Infinity;
      }
      return;
    }

    if (frozen) {
      this.rig.update(dt, { speed: 0, grounded: true, swing: null, combo: 0 });
      return;
    }

    switch (this.state) {
      case 'idle': {
        if (dist < s.aggro && player.hp > 0) {
          this.state = 'chase';
          this.alert.visible = true;
          this.timer = 0.6;
          break;
        }
        if (this.timer <= 0) {
          this.timer = 2 + Math.random() * 2;
          const a = Math.random() * Math.PI * 2;
          this.wander.set(this.body.pos.x + Math.cos(a) * 3, 0, this.body.pos.z + Math.sin(a) * 3);
        }
        move = this.wander.clone().sub(this.body.pos).setY(0);
        if (move.length() > 0.5) {
          move.normalize();
          speed = s.speed * 0.35;
        } else move.set(0, 0, 0);
        break;
      }
      case 'chase': {
        if (this.timer <= 0) this.alert.visible = false;
        if (dist > s.aggro * 1.8 || player.hp <= 0) {
          this.state = 'idle';
          break;
        }
        if (dist < 1.9) {
          this.state = 'windup';
          this.timer = s.windup;
          this.alert.visible = true;
          break;
        }
        move = toPlayer.clone().normalize();
        speed = s.speed;
        break;
      }
      case 'windup':
        this.heading = Math.atan2(toPlayer.x, toPlayer.z);
        if (this.timer <= 0) {
          this.state = 'strike';
          this.timer = 0.2;
          this.alert.visible = false;
          this.audio.sfx('sword_swing', { pitch: 0.8 });
          if (dist < 2.3) player.damage(s.damage, this.body.pos);
        }
        break;
      case 'strike':
        if (this.timer <= 0) {
          this.state = 'recover';
          this.timer = 1.0;
        }
        break;
      case 'recover':
      case 'hurt':
        if (this.timer <= 0) this.state = 'chase';
        break;
    }

    // 서로 겹치지 않게
    for (const o of others) {
      if (o === this || !o.alive) continue;
      const d = this.body.pos.clone().sub(o.body.pos).setY(0);
      const len = d.length();
      if (len > 0 && len < 1.2) move.addScaledVector(d.normalize(), (1.2 - len) * 1.5);
    }
    if (dist > 0 && dist < 1.1) move.addScaledVector(toPlayer.clone().normalize(), -1);

    let dx = move.x * speed * dt;
    let dz = move.z * speed * dt;
    if (this.knock.lengthSq() > 0.01) {
      dx += this.knock.x * dt;
      dz += this.knock.z * dt;
      this.knock.multiplyScalar(Math.exp(-dt * 7));
    }
    if (speed > 0 && this.state !== 'windup') {
      const target = Math.atan2(move.x, move.z);
      let diff = target - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.heading += diff * Math.min(1, dt * 8);
    }
    stepBody(this.body, dx, dz, dt, world);

    const windup = this.state === 'windup' ? 1 - Math.max(0, this.timer) / s.windup : 0;
    const swing = this.state === 'strike' ? 1 - Math.max(0, this.timer) / 0.2 : null;
    this.rig.update(dt, { speed: speed / Math.max(0.1, s.speed), grounded: this.body.grounded, swing, combo: 0, windup });
    this.sync();
    this.model.visible = this.flash <= 0 || Math.floor(this.flash * 30) % 2 === 0;
  }

  private sync() {
    this.root.position.copy(this.body.pos);
    this.root.rotation.y = this.heading;
  }
}
