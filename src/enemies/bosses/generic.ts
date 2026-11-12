/**
 * 기본 보스 패턴 — 전용 패턴(<id>.ts)이 아직 없는 보스가 쓴다. 장이 멈추지 않게 하는 임시 대역.
 * 다가가기 → 예고 공격 → 쉬기를 세 번 하면 지쳐서 약점 퀴즈.
 */
import type { BossFactory, BossId, HazardEffect } from '../../types/contracts';

export interface GenericOptions {
  name: string;
  melee?: boolean;
  /** 땅 위로 떠 있는 높이 (하늘의 보스) */
  lift?: number;
  effect?: HazardEffect;
  greeting?: string;
}

export function genericBoss(id: BossId, o: GenericOptions): BossFactory {
  return () => {
    let state: 'move' | 'windup' | 'rest' = 'move';
    let t = 0;
    let attacks = 0;
    return {
      id,
      name: o.name,
      model: id,
      maxHp: 10,
      melee: o.melee ?? true,
      quizDamage: 4,
      start(ctx) {
        ctx.say(o.greeting ?? '여기는 지나갈 수 없어!');
      },
      update(ctx, dt) {
        t += dt;
        const p = ctx.player;
        const b = ctx.boss;
        ctx.face(p.x, p.z);
        if (state === 'move') {
          ctx.pose('walk');
          ctx.moveTo(p.x, p.z, 1.8, o.lift);
          if (t > 1.6) {
            state = 'windup';
            t = 0;
          }
        } else if (state === 'windup') {
          ctx.pose('windup');
          ctx.moveTo(b.x, b.z, 0, o.lift);
          if (t > 0.5) {
            ctx.telegraph(p.x, p.z, 2, 1.1, o.effect ?? 'stomp');
            ctx.pose('strike');
            attacks++;
            state = 'rest';
            t = 0;
          }
        } else if (t > 1.2) {
          if (attacks % 3 === 0) {
            ctx.pose('tired');
            ctx.weak();
          }
          state = 'move';
          t = 0;
        }
      },
    };
  };
}
