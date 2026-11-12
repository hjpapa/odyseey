import type { BossFactory } from '../../types/contracts';

/** Three rows of notes sweep the stage, with room to pass between the notes. */
const sirenQueen: BossFactory = () => {
  let state: 'rest' | 'notes' = 'rest';
  let timer = 0;
  let row = 0;
  let phrases = 0;
  let nextWeak = 32;

  return {
    id: 'sirenQueen',
    name: '세이렌 여왕',
    model: 'sirenQueen',
    maxHp: 12,
    melee: true,
    quizDamage: 4,

    start(ctx) {
      ctx.say('음표 사이로 지나가렴!');
      ctx.pose('idle');
    },

    update(ctx, dt) {
      const boss = ctx.boss;
      ctx.moveTo(boss.x, boss.z, 0);
      ctx.face(ctx.player.x, ctx.player.z);

      if (ctx.time >= nextWeak) {
        nextWeak = ctx.time + 32;
        state = 'rest';
        timer = 0;
        row = 0;
        ctx.pose('tired');
        ctx.say('잠깐, 숨을 고를게.');
        ctx.weak();
        return;
      }

      timer += dt;
      if (state === 'rest') {
        ctx.pose(row > 0 && timer < 0.45 ? 'strike' : 'idle');
        if (timer >= 2.4) {
          state = 'notes';
          timer = 0;
          row = 0;
          ctx.say('음표가 줄지어 온다!');
        }
        return;
      }

      ctx.pose(row > 0 && timer < 0.45 ? 'strike' : 'windup');
      if (timer < 1.4) return;

      const arena = ctx.arena;
      const direction = phrases % 2 === 0 ? 1 : -1;
      const z = arena.z + (row - 1) * direction * arena.radius * 0.4;
      for (const column of [-1, 0, 1]) {
        const x = arena.x + column * arena.radius * 0.45;
        ctx.telegraph(x, z, 1.35, 1.3, 'magic');
      }
      ctx.pose('strike');
      ctx.sfx('magic');
      timer = 0;
      row++;

      if (row === 3) {
        phrases++;
        state = 'rest';
        if (phrases % 2 === 0) {
          ctx.say('친구들아, 함께 연주하자!');
          ctx.summon('siren', 2);
        }
      }
    },
  };
};

export default sirenQueen;
