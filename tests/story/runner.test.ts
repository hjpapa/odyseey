import { describe, expect, it } from 'vitest';
import { ChapterRunner, type RunnerHost } from '../../src/story/runner';
import { chapters } from '../../src/content';
import type { ChapterData, Objective, SceneStep } from '../../src/types/contracts';

function fakeHost() {
  const log: string[] = [];
  const inv: Record<string, number> = {};
  const host: RunnerHost = {
    async playSteps(steps: SceneStep[]) {
      for (const s of steps) log.push(s.type === 'quiz' ? `quiz:${s.slot}` : s.type);
    },
    onObjective: (o: Objective | null) => log.push(`obj:${o?.id ?? 'none'}`),
    onProgress: (o, have, need) => log.push(`progress:${o.id}:${have}/${need}`),
    onObjectiveDone: (o) => log.push(`done:${o.id}`),
    inventory: (item) => inv[item] ?? 0,
    askSlot: async (id) => void log.push(`ask:${id}`),
    idleTalk: async (npc) => void log.push(`idle:${npc}`),
  };
  return { host, log, inv };
}

describe('챕터 진행기', () => {
  it('1장을 처음부터 끝까지 진행한다', async () => {
    const ch = chapters.ch01 as ChapterData;
    const { host, log, inv } = fakeHost();
    const r = new ChapterRunner(ch, host);
    r.start();
    await r.idle();
    expect(r.objective?.id).toBe('o-hermes');

    r.emit({ type: 'talk', npc: 'calypso' }); // 아직 칼립소 차례가 아님
    r.emit({ type: 'talk', npc: 'hermes' });
    await r.idle();
    expect(log).toContain('idle:calypso');
    expect(r.objective?.id).toBe('o-train');

    for (let i = 0; i < 3; i++) r.emit({ type: 'defeat', group: 'shadows' });
    await r.idle();
    expect(r.objective?.id).toBe('o-logs');

    inv.log = 4;
    r.emit({ type: 'pickup', item: 'log' });
    await r.idle();
    expect(r.objective?.id).toBe('o-logs');
    inv.log = 5;
    r.emit({ type: 'pickup', item: 'log' });
    await r.idle();
    expect(r.objective?.id).toBe('o-raft');

    r.emit({ type: 'minigame', id: 'raftBuild' });
    await r.idle();
    expect(log).toContain('quiz:raft-math');
    expect(r.objective?.id).toBe('o-farewell');

    r.emit({ type: 'talk', npc: 'calypso' });
    await r.idle();
    expect(log).toContain('quiz:farewell');
    await r.done;
    expect(r.finished).toBe(true);
    expect(log[log.length - 1]).toBe('caption');
  });

  it('미리 모아 둔 아이템은 목표가 켜지자마자 센다', async () => {
    const ch = chapters.ch01 as ChapterData;
    const { host, inv } = fakeHost();
    inv.log = 5;
    const r = new ChapterRunner(ch, host);
    r.start();
    r.emit({ type: 'talk', npc: 'hermes' });
    for (let i = 0; i < 3; i++) r.emit({ type: 'defeat', group: 'shadows' });
    await r.idle();
    expect(r.objective?.id).toBe('o-raft');
  });

  it('2장: 미니게임 뒤 퀴즈 목표는 바로 묻고 끝난다', async () => {
    const ch = chapters.ch02 as ChapterData;
    const { host, log } = fakeHost();
    const r = new ChapterRunner(ch, host);
    r.start();
    r.emit({ type: 'zone', zone: 'calm-1' });
    r.emit({ type: 'zone', zone: 'calm-1' });
    r.emit({ type: 'minigame', id: 'waveRunner' });
    await r.done;
    expect(log.filter((l) => l === 'quiz:ino-1')).toHaveLength(1);
    expect(log).toContain('ask:ino-final');
  });
});
