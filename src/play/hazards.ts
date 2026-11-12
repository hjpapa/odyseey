/**
 * 예고 공격 — 땅에 빨간 원을 그리고(안쪽이 차오름), 시간이 되면 그 자리를 친다.
 * 보스 패턴(BossContext.telegraph)과 '버티기' 목표가 함께 쓴다.
 */
import { BoxGeometry, CircleGeometry, Mesh, MeshBasicMaterial, MeshToonMaterial, RingGeometry, type Scene } from 'three';
import type { HazardEffect } from '../types/contracts';

export interface Impact {
  x: number;
  z: number;
  r: number;
  effect: HazardEffect;
}

interface Hazard extends Impact {
  delay: number;
  t: number;
  y: number;
  ring: Mesh;
  fill: Mesh;
  drop?: Mesh;
}

const ringGeo = new RingGeometry(0.9, 1, 40);
const discGeo = new CircleGeometry(1, 32);
const rockGeo = new BoxGeometry(1, 1, 1);
const boltGeo = new BoxGeometry(0.35, 1, 0.35);
const DROP: Partial<Record<HazardEffect, { color: string; height: number }>> = {
  rock: { color: '#8e979f', height: 16 },
  lightning: { color: '#fff3a0', height: 30 },
};

export class Hazards {
  private list: Hazard[] = [];

  constructor(
    private scene: Scene,
    private ground: (x: number, z: number) => number,
    private onImpact: (hit: Impact) => void,
  ) {}

  get count() {
    return this.list.length;
  }

  add(x: number, z: number, r: number, delay: number, effect: HazardEffect) {
    const y = this.ground(x, z) + 0.06;
    const ring = new Mesh(ringGeo, new MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.85, depthWrite: false }));
    const fill = new Mesh(discGeo, new MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.3, depthWrite: false }));
    for (const m of [ring, fill]) {
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.renderOrder = 2;
    }
    ring.scale.setScalar(r);
    fill.scale.setScalar(0.01);
    this.scene.add(ring, fill);
    let drop: Mesh | undefined;
    const d = DROP[effect];
    if (d) {
      drop = new Mesh(effect === 'rock' ? rockGeo : boltGeo, effect === 'rock' ? new MeshToonMaterial({ color: d.color }) : new MeshBasicMaterial({ color: d.color }));
      if (effect === 'rock') drop.scale.setScalar(r * 0.9);
      else drop.scale.set(1, d.height, 1);
      drop.visible = false;
      this.scene.add(drop);
    }
    this.list.push({ x, z, r, effect, delay: Math.max(0.6, delay), t: 0, y, ring, fill, drop });
  }

  update(dt: number) {
    for (const h of this.list) {
      h.t += dt;
      const k = Math.min(1, h.t / h.delay);
      h.fill.scale.setScalar(Math.max(0.01, h.r * k));
      (h.ring.material as MeshBasicMaterial).opacity = 0.55 + 0.4 * Math.abs(Math.sin(h.t * 10));
      if (h.drop && h.effect === 'rock') {
        // 마지막 0.5초 동안 하늘에서 떨어진다
        const fall = Math.max(0, h.delay - h.t);
        h.drop.visible = fall < 0.5;
        h.drop.position.set(h.x, h.y + (fall / 0.5) * 16 + h.r * 0.45, h.z);
        h.drop.rotation.set(h.t * 3, h.t * 2, 0);
      }
      if (h.t >= h.delay) {
        if (h.drop && h.effect === 'lightning') {
          h.drop.visible = true;
          h.drop.position.set(h.x, h.y + 15, h.z);
        }
        this.onImpact(h);
      }
    }
    const done = this.list.filter((h) => h.t >= h.delay);
    if (done.length) {
      for (const h of done) this.dispose(h, 0.25);
      this.list = this.list.filter((h) => h.t < h.delay);
    }
  }

  clear() {
    for (const h of this.list) this.dispose(h, 0);
    this.list = [];
  }

  private dispose(h: Hazard, afterSec: number) {
    const remove = () => {
      h.ring.removeFromParent();
      h.fill.removeFromParent();
      h.drop?.removeFromParent();
      (h.ring.material as MeshBasicMaterial).dispose();
      (h.fill.material as MeshBasicMaterial).dispose();
      (h.drop?.material as MeshBasicMaterial | undefined)?.dispose();
    };
    if (afterSec > 0) {
      h.ring.visible = false;
      h.fill.visible = false;
      setTimeout(remove, afterSec * 1000);
    } else remove();
  }
}

/** 효과별 색·소리 */
export const IMPACT_STYLE: Record<HazardEffect, { color: string; sfx: 'boss_hit' | 'thunder' | 'splash' | 'magic' | 'land'; shake: number }> = {
  rock: { color: '#9aa3ad', sfx: 'boss_hit', shake: 0.35 },
  lightning: { color: '#fff6a8', sfx: 'thunder', shake: 0.25 },
  splash: { color: '#7fd3ff', sfx: 'splash', shake: 0.15 },
  magic: { color: '#c084fc', sfx: 'magic', shake: 0.1 },
  stomp: { color: '#d7a86e', sfx: 'land', shake: 0.4 },
};
