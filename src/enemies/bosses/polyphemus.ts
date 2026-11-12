/**
 * [견본 보스] 3장 외눈 거인 폴리페모스(폴리페오스)
 *
 * Codex 가 새 보스를 만들 때 이 파일을 복사해 src/enemies/bosses/<id>.ts 로 만들고,
 * index.ts 의 BOSSES 에 한 줄 등록한다. 규칙은 src/types/contracts.ts 10장 (BossContext·BossDef).
 *
 * 흐름(상태 기계): 다가가기 → 바위 던지기 ×3 → 발 구르기 → 지침(약점 퀴즈) → 다시 처음
 * 체력이 절반 아래로 내려가면 '화남' — 더 빨리 움직이고 던진다.
 * 아이용 원칙: 공격은 반드시 땅의 빨간 원으로 예고(1초 안팎), 한 번에 하트 1, 무섭지 않은 말투.
 */
import type { BossFactory } from '../../types/contracts';

const polyphemus: BossFactory = () => {
  let state: 'approach' | 'throw' | 'stomp' | 'tired' = 'approach';
  let t = 0;
  let throws = 0;
  let angry = false;

  return {
    id: 'polyphemus',
    name: '외눈 거인 폴리페모스',
    model: 'polyphemus',
    maxHp: 12,
    melee: true,
    quizDamage: 4,

    start(ctx) {
      ctx.say('누구냐! 내 동굴에 들어온 녀석은!');
    },

    update(ctx, dt) {
      t += dt;
      const p = ctx.player;
      const b = ctx.boss;
      const gap = angry ? 1.15 : 1.6;

      if (!angry && ctx.hp <= ctx.maxHp / 2) {
        angry = true;
        ctx.say('으아아! 화났다!');
        ctx.phase('angry');
        ctx.sfx('boss_roar');
        ctx.shake(0.5);
      }

      switch (state) {
        case 'approach':
          ctx.pose('walk');
          ctx.face(p.x, p.z);
          ctx.moveTo(p.x, p.z, angry ? 2.6 : 2);
          if (t > 2.2 || Math.hypot(p.x - b.x, p.z - b.z) < 5) {
            state = 'throw';
            t = 0;
            throws = 0;
          }
          break;

        case 'throw':
          ctx.moveTo(b.x, b.z, 0);
          ctx.face(p.x, p.z);
          ctx.pose(t < gap * 0.5 ? 'windup' : 'strike');
          if (t >= gap) {
            // 플레이어가 서 있던 자리에 바위 — 1.2초 안에 비키면 된다
            ctx.telegraph(p.x, p.z, 1.8, 1.2, 'rock');
            ctx.sfx('sword_swing');
            throws++;
            t = 0;
            if (throws >= 3) state = 'stomp';
          }
          break;

        case 'stomp':
          ctx.pose(t < 0.7 ? 'windup' : 'strike');
          if (t >= 0.7) {
            // 거인 둘레 네 곳을 쿵! — 거인에게서 떨어지면 안전
            for (let i = 0; i < 4; i++) {
              const a = (i * Math.PI) / 2 + ctx.time;
              ctx.telegraph(b.x + Math.cos(a) * 3.5, b.z + Math.sin(a) * 3.5, 2.2, 1.0, 'stomp');
            }
            ctx.shake(0.4);
            state = 'tired';
            t = 0;
          }
          break;

        case 'tired':
          ctx.pose('tired');
          if (t > 1.4) {
            ctx.say('아이고… 눈이 감겨…');
            ctx.weak();
            state = 'approach';
            t = 0;
          }
          break;
      }
    },
  };
};

export default polyphemus;
