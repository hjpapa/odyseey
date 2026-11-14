import type { BossFactory } from '../../types/contracts';

/** 둥근 물약 무늬와 한 곳을 겨냥하는 물약을 번갈아 피한다. */
const circe: BossFactory = () => {
  let state: 'circle' | 'cast' | 'rest' = 'circle';
  let stateTime = 0;
  let weakTime = 0;
  let orbitAngle = 0;
  let casts = 0;
  let pigsSummoned = false;

  return {
    id: 'circe',
    name: '마녀 키르케',
    model: 'circe',
    maxHp: 10,
    melee: true,
    quizDamage: 4,

    start(ctx) {
      ctx.moveTo(ctx.boss.x, ctx.boss.z, 0);
      ctx.say('하얀 꽃을 챙겼구나!');
    },

    update(ctx, dt) {
      stateTime += dt;
      weakTime += dt;
      const { arena, boss, player } = ctx;
      ctx.face(player.x, player.z);

      if (weakTime >= 34) {
        weakTime = 0;
        stateTime = 0;
        state = 'rest';
        ctx.moveTo(boss.x, boss.z, 0);
        ctx.pose('tired');
        ctx.say('잠깐, 마법책을 볼까?');
        ctx.weak();
        return;
      }

      switch (state) {
        case 'circle': {
          orbitAngle += dt * 0.4;
          const orbitRadius = Math.min(2.5, arena.radius * 0.28);
          ctx.moveTo(
            arena.x + Math.cos(orbitAngle) * orbitRadius,
            arena.z + Math.sin(orbitAngle) * orbitRadius,
            1.6,
          );
          ctx.pose('walk');
          if (stateTime >= 3) {
            ctx.moveTo(boss.x, boss.z, 0);
            state = 'cast';
            stateTime = 0;
          }
          break;
        }

        case 'cast': {
          ctx.moveTo(boss.x, boss.z, 0);
          ctx.pose('windup');
          if (stateTime < 0.9) break;

          if (casts % 2 === 0) {
            const ringRadius = Math.min(4.5, arena.radius * 0.6);
            for (let i = 0; i < 6; i++) {
              const angle = orbitAngle + (i * Math.PI) / 3;
              ctx.telegraph(
                arena.x + Math.cos(angle) * ringRadius,
                arena.z + Math.sin(angle) * ringRadius,
                1.3,
                1.4,
                'magic',
              );
            }
            ctx.say('물약 원을 피해 보렴!');
          } else {
            const dx = player.x - arena.x;
            const dz = player.z - arena.z;
            const distance = Math.hypot(dx, dz);
            const scale = Math.min(1, (arena.radius - 1.6) / Math.max(distance, 0.001));
            ctx.telegraph(arena.x + dx * scale, arena.z + dz * scale, 1.6, 1.4, 'magic');
          }

          // 살아 있는 수를 조회할 수 없으므로 보스전 전체에서 세 마리만 부른다.
          if (!pigsSummoned) {
            pigsSummoned = true;
            ctx.summon('pig', 3);
            ctx.sfx('pig');
          }
          ctx.sfx('magic');
          ctx.pose('strike');
          casts++;
          state = 'rest';
          stateTime = 0;
          break;
        }

        case 'rest':
          ctx.moveTo(boss.x, boss.z, 0);
          ctx.pose('idle');
          if (stateTime >= 2.1) {
            state = 'circle';
            stateTime = 0;
          }
          break;
      }
    },
  };
};

export default circe;
