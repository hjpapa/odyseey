import type { BossFactory } from '../../types/contracts';

/** Five quiz windows cover the palace chapter's five subjects without sword hits. */
const antinous: BossFactory = () => {
  let state: 'approach' | 'windup' | 'rest' = 'approach';
  let timer = 0;
  let attacks = 0;
  let angry = false;
  let nextWeak = 32;

  return {
    id: 'antinous',
    name: '구혼자 대장 안티노오스',
    model: 'antinous',
    maxHp: 15,
    melee: true,
    quizDamage: 3,

    start(ctx) {
      ctx.say('내가 이 궁전의 대장이야!');
      ctx.pose('idle');
    },

    update(ctx, dt) {
      const boss = ctx.boss;
      if (!angry && ctx.hp < ctx.maxHp / 2) {
        angry = true;
        ctx.phase('angry');
        ctx.say('이제 조금 더 빨라질 거야!');
        ctx.sfx('boss_roar');
      }

      if (ctx.time >= nextWeak) {
        nextWeak = ctx.time + 32;
        state = 'rest';
        timer = 0;
        ctx.moveTo(boss.x, boss.z, 0);
        ctx.pose('tired');
        ctx.say('지혜 겨루기도 해 보자!');
        ctx.weak();
        return;
      }

      timer += dt;
      ctx.face(ctx.player.x, ctx.player.z);
      if (state === 'approach') {
        const arena = ctx.arena;
        const dx = ctx.player.x - arena.x;
        const dz = ctx.player.z - arena.z;
        const scale = Math.min(1, arena.radius * 0.6 / Math.max(0.001, Math.hypot(dx, dz)));
        ctx.moveTo(arena.x + dx * scale, arena.z + dz * scale, angry ? 2.3 : 1.8);
        ctx.pose('walk');
        if (timer >= 1.8) {
          ctx.moveTo(boss.x, boss.z, 0);
          ctx.pose('windup');
          state = 'windup';
          timer = 0;
        }
        return;
      }

      ctx.moveTo(boss.x, boss.z, 0);
      if (state === 'windup') {
        ctx.pose('windup');
        if (timer < 0.8) return;

        const arena = ctx.arena;
        const dx = ctx.player.x - arena.x;
        const dz = ctx.player.z - arena.z;
        const scale = Math.min(1, Math.max(0, arena.radius - 1.8) / Math.max(0.001, Math.hypot(dx, dz)));
        const x = arena.x + dx * scale;
        const z = arena.z + dz * scale;
        ctx.telegraph(x, z, 1.7, 1.3, 'stomp');
        if (angry) {
          const side = x > arena.x ? -1 : 1;
          ctx.telegraph(arena.x + side * arena.radius * 0.4, arena.z, 1.7, 1.5, 'stomp');
        }
        ctx.pose('strike');
        attacks++;
        if (attacks % 3 === 0) {
          ctx.say('친구들아, 함께하자!');
          ctx.summon('suitor', angry ? 2 : 1);
        }
        state = 'rest';
        timer = 0;
        return;
      }

      if (timer >= 0.45) ctx.pose('idle');
      if (timer >= 2.2) {
        state = 'approach';
        timer = 0;
      }
    },
  };
};

export default antinous;
