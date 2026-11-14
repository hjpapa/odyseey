import type { BossFactory } from '../../types/contracts';

/** The destination is marked before a short dash, and the stomp lands afterward. */
const soldierCaptain: BossFactory = () => {
  let state: 'approach' | 'windup' | 'dash' | 'recover' = 'approach';
  let timer = 0;
  let targetX = 0;
  let targetZ = 0;
  let charges = 0;
  let nextWeak = 34;

  return {
    id: 'soldierCaptain',
    name: '병사 대장',
    model: 'soldierCaptain',
    maxHp: 12,
    melee: true,
    quizDamage: 4,

    start(ctx) {
      ctx.say('돌진할 땐 옆으로 피해!');
      ctx.pose('idle');
    },

    update(ctx, dt) {
      const boss = ctx.boss;
      if (ctx.time >= nextWeak) {
        nextWeak = ctx.time + 34;
        state = 'recover';
        timer = 0;
        ctx.moveTo(boss.x, boss.z, 0);
        ctx.pose('tired');
        ctx.say('후우, 잠시 쉬어야겠어.');
        ctx.weak();
        return;
      }

      timer += dt;
      if (state === 'approach') {
        const arena = ctx.arena;
        const dx = ctx.player.x - arena.x;
        const dz = ctx.player.z - arena.z;
        const distance = Math.hypot(dx, dz);
        const limit = Math.max(0, arena.radius - 2.4);
        const scale = Math.min(1, limit / Math.max(0.001, distance));
        const aimX = arena.x + dx * scale;
        const aimZ = arena.z + dz * scale;
        ctx.face(aimX, aimZ);
        ctx.pose('walk');
        ctx.moveTo(aimX, aimZ, 1.8);
        if (timer < 1.6) return;

        // Fix the endpoint now so the warning never follows a dodging player.
        const stepX = aimX - boss.x;
        const stepZ = aimZ - boss.z;
        const dashScale = Math.min(1, 6 / Math.max(0.001, Math.hypot(stepX, stepZ)));
        targetX = boss.x + stepX * dashScale;
        targetZ = boss.z + stepZ * dashScale;
        ctx.moveTo(boss.x, boss.z, 0);
        ctx.pose('windup');
        ctx.say('빨간 원 밖으로 피해!');
        ctx.telegraph(targetX, targetZ, 2.4, 2, 'stomp');
        state = 'windup';
        timer = 0;
        return;
      }

      if (state === 'windup') {
        ctx.moveTo(boss.x, boss.z, 0);
        ctx.face(targetX, targetZ);
        ctx.pose('windup');
        if (timer >= 1.1) {
          state = 'dash';
          timer = 0;
          ctx.pose('walk');
          ctx.moveTo(targetX, targetZ, 12);
          ctx.sfx('sword_swing');
        }
        return;
      }

      if (state === 'dash') {
        ctx.face(targetX, targetZ);
        ctx.pose('walk');
        ctx.moveTo(targetX, targetZ, 12);
        if (Math.hypot(targetX - boss.x, targetZ - boss.z) > 0.2 && timer < 0.6) return;

        ctx.moveTo(boss.x, boss.z, 0);
        ctx.pose('strike');
        state = 'recover';
        timer = 0;
        charges++;
        if (charges % 3 === 0) {
          ctx.say('동료들아, 함께하자!');
          ctx.summon('greekSoldier', 2);
        }
        return;
      }

      ctx.moveTo(boss.x, boss.z, 0);
      if (timer >= 0.5) ctx.pose('idle');
      if (timer >= 2.4) {
        state = 'approach';
        timer = 0;
      }
    },
  };
};

export default soldierCaptain;
