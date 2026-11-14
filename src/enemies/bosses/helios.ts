import type { BossFactory } from '../../types/contracts';

/** 하늘의 헬리오스는 벼락을 피한 뒤 시계 퀴즈로만 이긴다. */
const helios: BossFactory = () => {
  let state: 'glide' | 'cast' | 'rest' = 'glide';
  let stateTime = 0;
  let weakTime = 0;
  let orbitAngle = 0;
  let casts = 0;

  return {
    id: 'helios',
    name: '태양신 헬리오스',
    model: 'helios',
    maxHp: 10,
    melee: false,
    quizDamage: 4,

    start(ctx) {
      ctx.moveTo(ctx.boss.x, ctx.boss.z, 0, 6);
      ctx.say('빛나는 곳을 피해 보렴!');
    },

    update(ctx, dt) {
      stateTime += dt;
      weakTime += dt;
      const { arena, boss, player } = ctx;
      ctx.face(player.x, player.z);

      if (weakTime >= 32) {
        weakTime = 0;
        stateTime = 0;
        state = 'rest';
        ctx.moveTo(boss.x, boss.z, 0, 6);
        ctx.pose('tired');
        ctx.say('시계를 읽어 볼까?');
        ctx.weak();
        return;
      }

      switch (state) {
        case 'glide': {
          orbitAngle += dt * 0.25;
          const orbitRadius = Math.min(3.5, arena.radius * 0.35);
          ctx.moveTo(
            arena.x + Math.cos(orbitAngle) * orbitRadius,
            arena.z + Math.sin(orbitAngle) * orbitRadius,
            2,
            6,
          );
          ctx.pose('idle');
          if (stateTime >= 3.6) {
            ctx.moveTo(boss.x, boss.z, 0, 6);
            state = 'cast';
            stateTime = 0;
          }
          break;
        }

        case 'cast': {
          ctx.moveTo(boss.x, boss.z, 0, 6);
          ctx.pose('windup');
          if (stateTime < 1) break;

          const dx = player.x - arena.x;
          const dz = player.z - arena.z;
          if (casts % 2 === 0) {
            const distance = Math.hypot(dx, dz);
            const scale = Math.min(1, (arena.radius - 1.8) / Math.max(distance, 0.001));
            ctx.telegraph(arena.x + dx * scale, arena.z + dz * scale, 1.8, 1.4, 'lightning');
          } else {
            const direction = Math.atan2(dz, dx);
            const strikeRadius = arena.radius * 0.55;
            for (let i = 0; i < 3; i++) {
              const angle = direction + (i - 1) * 0.8;
              ctx.telegraph(
                arena.x + Math.cos(angle) * strikeRadius,
                arena.z + Math.sin(angle) * strikeRadius,
                1.4,
                1.3 + i * 0.2,
                'lightning',
              );
            }
          }
          ctx.sfx('thunder');
          ctx.pose('strike');
          casts++;
          state = 'rest';
          stateTime = 0;
          break;
        }

        case 'rest':
          ctx.moveTo(boss.x, boss.z, 0, 6);
          ctx.pose('idle');
          if (stateTime >= 2.4) {
            state = 'glide';
            stateTime = 0;
          }
          break;
      }
    },
  };
};

export default helios;
