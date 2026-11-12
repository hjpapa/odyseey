import type { BossFactory } from '../../types/contracts';

/** 느린 꽃가루 세 송이 → 동료 부르기. 꽃향기에 졸리면 가족 퀴즈로 기억을 깨운다. */
const lotusKing: BossFactory = () => {
  let state: 'drift' | 'pollen' | 'rest' = 'drift';
  let stateTime = 0;
  let cycleTime = 0;
  let blooms = 0;

  return {
    id: 'lotusKing',
    name: '연꽃 대장',
    model: 'lotusKing',
    maxHp: 10,
    melee: true,
    quizDamage: 4,

    start(ctx) {
      ctx.say('꽃향기 맡고 쉬어 가렴~');
      ctx.pose('idle');
    },

    update(ctx, dt) {
      cycleTime += dt;
      stateTime += dt;
      const player = ctx.player;
      const boss = ctx.boss;
      ctx.face(player.x, player.z);

      // 마지막 꽃가루가 가라앉은 뒤, 매 34초에 약점을 한 번 드러낸다.
      if (cycleTime >= 32) {
        ctx.moveTo(boss.x, boss.z, 0);
        ctx.pose('tired');
        if (cycleTime >= 34) {
          cycleTime = 0;
          stateTime = 0;
          state = 'drift';
          blooms = 0;
          ctx.say('하암… 가족이 보고 싶네.');
          ctx.weak();
        }
        return;
      }

      switch (state) {
        case 'drift':
          ctx.pose('walk');
          ctx.moveTo(player.x, player.z, 0.8);
          if (stateTime >= 2.8) {
            state = 'pollen';
            stateTime = 0;
            ctx.moveTo(boss.x, boss.z, 0);
            ctx.pose('windup');
            ctx.say('꽃가루가 날아가요~');
          }
          break;

        case 'pollen': {
          ctx.moveTo(boss.x, boss.z, 0);
          ctx.pose('windup');
          if (stateTime < 1.8) break;
          const dx = player.x - ctx.arena.x;
          const dz = player.z - ctx.arena.z;
          const scale = Math.min(1, Math.max(0, ctx.arena.radius - 4) / Math.max(1, Math.hypot(dx, dz)));
          const x = ctx.arena.x + dx * scale;
          const z = ctx.arena.z + dz * scale;
          // 작은 삼각형 꽃밭처럼 피며, 꽃밭 바깥으로 피할 공간을 남긴다.
          ctx.telegraph(x, z, 1.6, 1.8, 'magic');
          for (const side of [-1, 1]) {
            ctx.telegraph(x + side * 2.8, z + 1.4, 1.4, 2.2, 'magic');
          }
          ctx.sfx('magic');
          ctx.pose('strike');
          blooms++;
          state = 'rest';
          stateTime = 0;
          break;
        }

        case 'rest':
          ctx.moveTo(boss.x, boss.z, 0);
          ctx.pose(stateTime < 0.4 ? 'strike' : 'idle');
          if (stateTime >= 3) {
            if (blooms % 2 === 0) {
              ctx.say('친구들아, 같이 쉬자~');
              ctx.summon('lotusEater', 2);
            }
            state = 'drift';
            stateTime = 0;
          }
          break;
      }
    },
  };
};

export default lotusKing;
