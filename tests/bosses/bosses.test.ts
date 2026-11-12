// 보스 패턴 규칙 검사 (항상 통과해야 함). 전용 패턴 완성은 bosses.accept.test.ts 에서.
import { describe, expect, it } from 'vitest';
import { bossFactory } from '../../src/enemies/bosses';
import { BOSS_IDS, type BossContext, type BossDef, type BossId } from '../../src/types/contracts';
import { MODEL_IDS, has, len } from '../helpers/validate';

/** 스킬라는 바다 위 보스라 엔진이 직접 다룬다 */
export const LAND_BOSSES = BOSS_IDS.filter((id) => id !== 'scylla') as BossId[];

interface Log {
  telegraphs: { x: number; z: number; r: number; delay: number }[];
  weakAt: number[];
  says: string[];
  summons: number[];
  badMoves: number;
}

/** 엔진 없이 패턴을 돌려 보는 가짜 보스전 (약점 퀴즈는 2초 걸리고 늘 첫 시도에 맞힌다고 가정) */
export function simulate(def: BossDef, seconds: number): { log: Log; hp: number; defeatedAt: number | null } {
  const arena = { x: 10, z: -5, radius: 10 };
  const boss = { x: arena.x, z: arena.z };
  const player = { x: arena.x + 6, z: arena.z };
  let hp = def.maxHp;
  let time = 0;
  let busy = 0;
  const log: Log = { telegraphs: [], weakAt: [], says: [], summons: [], badMoves: 0 };
  let target = null as { x: number; z: number; speed: number } | null;
  const ctx: BossContext = {
    get time() { return time; },
    get hp() { return hp; },
    get maxHp() { return def.maxHp; },
    arena,
    get boss() { return { ...boss }; },
    get player() { return { ...player }; },
    moveTo(x, z, speed) {
      if (![x, z, speed].every(Number.isFinite)) log.badMoves++;
      target = { x, z, speed };
    },
    face() {},
    pose() {},
    telegraph(x, z, r, delay) { log.telegraphs.push({ x, z, r, delay }); },
    summon(_m, count) { log.summons.push(count); },
    weak() {
      if (busy > 0) return;
      log.weakAt.push(time);
      busy = 2;
      hp -= def.quizDamage;
    },
    say(text) { log.says.push(text); },
    sfx() {},
    shake() {},
    phase() {},
  };
  def.start?.(ctx);
  const dt = 1 / 30;
  let defeatedAt: number | null = null;
  for (let i = 0; i < seconds * 30 && hp > 0; i++) {
    // 플레이어는 무대 안을 빙글빙글 돈다
    player.x = arena.x + Math.cos(i / 90) * 6;
    player.z = arena.z + Math.sin(i / 90) * 6;
    if (busy > 0) {
      busy -= dt;
      continue;
    }
    time += dt;
    def.update(ctx, dt);
    if (target) {
      const dx = target.x - boss.x;
      const dz = target.z - boss.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01) {
        const step = Math.min(d, target.speed * dt);
        boss.x += (dx / d) * step;
        boss.z += (dz / d) * step;
      }
    }
    if (hp <= 0) defeatedAt = time;
  }
  if (hp <= 0 && defeatedAt === null) defeatedAt = time;
  return { log, hp, defeatedAt };
}

describe('보스 패턴 규칙', () => {
  it.each(LAND_BOSSES)('%s: 정의가 계약을 지킨다', (id) => {
    const make = bossFactory(id);
    const a = make();
    const b = make();
    expect(a).not.toBe(b);
    expect(a.id).toBe(id);
    expect(has(MODEL_IDS, a.model), `model '${a.model}'`).toBe(true);
    expect(a.maxHp).toBeGreaterThanOrEqual(6);
    expect(a.maxHp).toBeLessThanOrEqual(20);
    expect(a.quizDamage).toBeGreaterThanOrEqual(1);
    expect(a.quizDamage).toBeLessThanOrEqual(a.maxHp);
    expect(len(a.name)).toBeLessThanOrEqual(24);
  });

  it.each(LAND_BOSSES)('%s: 아이에게 공정한 공격, 약점이 꾸준히 드러나 3분 안에 이길 수 있다', (id) => {
    const { log, defeatedAt } = simulate(bossFactory(id)(), 180);
    expect(log.weakAt.length, '약점(weak) 이 한 번도 없음').toBeGreaterThan(0);
    expect(log.weakAt[0], '첫 약점은 40초 안에').toBeLessThan(40);
    expect(defeatedAt, '퀴즈를 맞히면 3분 안에 쓰러져야 함').not.toBeNull();
    for (const t of log.telegraphs) {
      expect(t.delay, '예고는 0.9초 이상').toBeGreaterThanOrEqual(0.9);
      expect(t.r).toBeGreaterThanOrEqual(1.2);
      expect(t.r).toBeLessThanOrEqual(3.5);
      expect(Math.hypot(t.x - 10, t.z + 5), '예고 위치는 무대 근처').toBeLessThan(10 + 6);
    }
    for (const s of log.says) expect(len(s), `말풍선 '${s}'`).toBeLessThanOrEqual(20);
    for (const n of log.summons) expect(n).toBeLessThanOrEqual(4);
    expect(log.badMoves).toBe(0);
  });

  it('보스전마다 새 패턴 (상태가 섞이지 않음)', () => {
    const first = simulate(bossFactory('polyphemus')(), 20);
    const second = simulate(bossFactory('polyphemus')(), 20);
    expect(second.log.telegraphs.length).toBe(first.log.telegraphs.length);
  });
});
