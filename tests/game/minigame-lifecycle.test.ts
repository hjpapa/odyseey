import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { IslandStage } from '../../src/game/islandStage';

const mini = vi.hoisted(() => ({ play: vi.fn() }));

vi.mock('../../src/story/minigames', () => ({
  ISLAND_MINIGAMES: { ballGame: mini.play },
  MINIGAME_LABEL: {},
}));

function fixture() {
  const life = new AbortController();
  const emit = vi.fn();
  const stage = {
    signal: life.signal,
    runner: { emit },
    playSteps: vi.fn().mockResolvedValue(undefined),
  } as unknown as IslandStage;
  return { stage, life, emit };
}

beforeEach(() => {
  mini.play.mockReset();
});

describe('섬 미니게임 수명', () => {
  it('미니게임 도중 장면을 나가면 완료 사건을 보내지 않는다', async () => {
    const { stage, life, emit } = fixture();
    mini.play.mockImplementation((active: IslandStage) => new Promise<void>((resolve) => {
      active.signal.addEventListener('abort', () => resolve(), { once: true });
    }));
    const pending = IslandStage.prototype.playMinigame.call(stage, 'ballGame', new Vector3());
    expect(mini.play).toHaveBeenCalledOnce();

    life.abort();
    await pending;

    expect(emit).not.toHaveBeenCalled();
  });

  it('정상적으로 마친 미니게임의 완료 사건은 한 번 보낸다', async () => {
    const { stage, emit } = fixture();
    const at = new Vector3(5, 1, -39);
    mini.play.mockResolvedValue(undefined);

    await IslandStage.prototype.playMinigame.call(stage, 'ballGame', at);

    expect(mini.play).toHaveBeenCalledExactlyOnceWith(stage, at);
    expect(emit).toHaveBeenCalledExactlyOnceWith({ type: 'minigame', id: 'ballGame' });
  });

  it('이미 떠난 장면에서는 미니게임을 시작하지 않는다', async () => {
    const { stage, life, emit } = fixture();
    life.abort();

    await IslandStage.prototype.playMinigame.call(stage, 'ballGame', new Vector3());

    expect(mini.play).not.toHaveBeenCalled();
    expect(stage.playSteps).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});
