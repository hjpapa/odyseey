import type { BossFactory } from '../../types/contracts';

/** 바위 세 개를 차례로 던지고 발을 구른다. 큰 동작 뒤에는 충분히 쉰다. */
const laestrygonianKing: BossFactory = () => {
  let state: 'approach' | 'throw' | 'stomp' | 'rest' = 'approach';
  let stateTime = 0;
  let cycleTime = 0;
  let rocks = 0;

  return {
    id: 'laestrygonianKing',
    name: '거인 왕 라이스트리고네스',
    model: 'laestrygonianKing',
    maxHp: 10,
    melee: true,
    quizDamage: 4,

    start(ctx) {
      ctx.say('큰 바위도 잘 피할 수 있니?');
      ctx.pose('idle');
    },

    update(ctx, dt) {
      cycleTime += dt;
      stateTime += dt;
      const player = ctx.player;
      const boss = ctx.boss;
      ctx.face(player.x, player.z);

      if (cycleTime >= 32) {
        ctx.moveTo(boss.x, boss.z, 0);
        ctx.pose('tired');
        if (cycleTime >= 34) {
          cycleTime = 0;
          stateTime = 0;
          state = 'approach';
          rocks = 0;
          ctx.say('휴, 잠깐 쉬어야겠어.');
          ctx.weak();
        }
        return;
      }

      switch (state) {
        case 'approach':
          ctx.pose('walk');
          ctx.moveTo(player.x, player.z, 1.5);
          if (stateTime >= 2.5) {
            ctx.moveTo(boss.x, boss.z, 0);
            ctx.pose('windup');
            ctx.say('바위 셋, 잘 피해 봐!');
            state = 'throw';
            stateTime = 0;
            rocks = 0;
          }
          break;

        case 'throw': {
          ctx.moveTo(boss.x, boss.z, 0);
          ctx.pose(rocks > 0 && stateTime < 0.4 ? 'strike' : 'windup');
          if (stateTime < 2.2) break;
          const dx = player.x - ctx.arena.x;
          const dz = player.z - ctx.arena.z;
          const scale = Math.min(1, Math.max(0, ctx.arena.radius - 2.5) / Math.max(1, Math.hypot(dx, dz)));
          ctx.telegraph(ctx.arena.x + dx * scale, ctx.arena.z + dz * scale, 2.3, 1.5, 'rock');
          ctx.sfx('sword_swing');
          ctx.pose('strike');
          rocks++;
          stateTime = 0;
          if (rocks >= 3) state = 'stomp';
          break;
        }

        case 'stomp':
          ctx.moveTo(boss.x, boss.z, 0);
          ctx.pose(stateTime < 0.4 ? 'strike' : 'windup');
          if (stateTime >= 2) {
            // 앞선 바위가 떨어진 다음, 거인에게서 멀어지면 피할 수 있는 한 번의 쿵.
            ctx.say('발 구르기! 멀리 비켜!');
            ctx.telegraph(boss.x, boss.z, 3, 1.4, 'stomp');
            ctx.pose('strike');
            state = 'rest';
            stateTime = 0;
          }
          break;

        case 'rest':
          ctx.moveTo(boss.x, boss.z, 0);
          ctx.pose(stateTime < 0.4 ? 'strike' : 'idle');
          if (stateTime >= 3) {
            state = 'approach';
            stateTime = 0;
          }
          break;
      }
    },
  };
};

export default laestrygonianKing;
