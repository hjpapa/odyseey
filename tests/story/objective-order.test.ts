import { describe, expect, it, vi } from 'vitest';
import { ChapterRunner, type RunnerHost } from '../../src/story/runner';
import { chapters } from '../../src/content';
import type { Objective } from '../../src/types/contracts';

function fixture(atZone = false) {
  const chapter = chapters.ch03!;
  const onObjectiveDone = vi.fn();
  const host: RunnerHost = {
    playSteps: async () => {},
    onObjective: () => {},
    onProgress: () => {},
    onObjectiveDone,
    inventory: () => 0,
    atZone: () => atZone,
    askSlot: async () => {},
    idleTalk: async () => {},
  };
  const guard = { id: 'speak', type: 'talk', target: 'crew', text: '말하기' } satisfies Objective;
  return { chapter, host, guard, onObjectiveDone };
}

describe('목표가 켜지기 전에 발견한 곳', () => {
  it('미리 푼 지혜의 문은 그 목표가 켜질 때 다시 풀지 않아도 된다', async () => {
    const { chapter, host, guard, onObjectiveDone } = fixture();
    const slot = chapter.quizSlots.find((quiz) => quiz.placement === 'gate')!;
    const gate = { id: 'enter', type: 'quiz', target: slot.id, text: '문 열기' } satisfies Objective;
    const runner = new ChapterRunner({ ...chapter, objectives: [guard, gate], scenes: [] }, host);
    runner.start();
    runner.emit({ type: 'quiz', slot: slot.id });
    await runner.idle();
    expect(runner.objective).toBe(guard);
    runner.emit({ type: 'talk', npc: 'crew' });
    await runner.idle();
    expect(runner.finished).toBe(true);
    expect(onObjectiveDone.mock.calls.map(([goal]) => goal.id)).toEqual(['speak', 'enter']);
  });

  it('플레이어가 이미 목표 구역에 서 있으면 다시 드나들지 않아도 된다', async () => {
    const { chapter, host, guard } = fixture(true);
    const reach = { id: 'reach', type: 'reach', target: 'path', text: '길 찾기' } satisfies Objective;
    const runner = new ChapterRunner({ ...chapter, objectives: [guard, reach], scenes: [] }, host);
    runner.start();
    runner.emit({ type: 'talk', npc: 'crew' });
    await runner.idle();
    expect(runner.finished).toBe(true);
  });
});
