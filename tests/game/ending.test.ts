/**
 * 엔딩 이야기 — 끝까지 멈추지 않고 흐르는가, 건너뛰어도 모두 모이는가,
 * 마지막 장면에서 모두가 아래쪽 '마지막 장' 카드에 가리지 않는가.
 */
import { describe, expect, it } from 'vitest';
import { EndingStage, FINAL_SPOT, FRIENDS } from '../../src/game/endingStage';
import type { DialogueUI } from '../../src/ui/dialogue';

/** 대사를 바로 넘기는 가짜 대화창 */
function fakeDialogue(said: string[]) {
  return {
    line: async (_who: string, text: string) => { said.push(text); },
    caption: async (text: string) => { said.push(text); },
  } as unknown as DialogueUI;
}

/** 장면 시간을 흘리며 약속이 끝나길 기다린다 (최대 sec 초) */
async function runUntil(stage: EndingStage, p: Promise<unknown>, sec: number) {
  let done = false;
  void p.then(() => (done = true));
  let t = 0;
  while (!done && t < sec) {
    stage.update(1 / 20);
    t += 1 / 20;
    await new Promise((r) => setTimeout(r, 0));
  }
  return { done, t };
}

describe('엔딩 — 이타카의 저녁', () => {
  it('이야기가 끝까지 흐르고, 친구들이 모두 나타나고, 불꽃이 터진다', async () => {
    const stage = new EndingStage();
    stage.resize(1024, 768);
    const said: string[] = [];
    const ac = new AbortController();
    const { done, t } = await runUntil(stage, stage.epilogue({ dialogue: fakeDialogue(said), sfx: () => {}, signal: ac.signal }), 90);
    expect(done).toBe(true);
    expect(t).toBeLessThan(60);
    const snap = stage.snapshot();
    expect(snap.fireworks).toBe(true);
    for (const id of FRIENDS) expect(snap.cast.find((c) => c.id === id)?.visible).toBe(true);
    expect(said.some((s) => s.includes('아버지'))).toBe(true);
    stage.dispose();
  });

  it('건너뛰면 남은 이야기를 하지 않고, finale() 로 모두 제자리에 모인다', async () => {
    const stage = new EndingStage();
    stage.resize(1024, 768);
    const said: string[] = [];
    const ac = new AbortController();
    const story = stage.epilogue({ dialogue: fakeDialogue(said), sfx: () => {}, signal: ac.signal });
    for (let i = 0; i < 20; i++) stage.update(1 / 20);
    ac.abort();
    const { done } = await runUntil(stage, story, 30);
    expect(done).toBe(true);
    expect(said.length).toBeLessThan(4);
    stage.finale();
    for (let i = 0; i < 40; i++) stage.update(1 / 20);
    for (const c of stage.snapshot().cast) {
      expect(c.visible).toBe(true);
      const [x, z] = FINAL_SPOT[c.id];
      expect(Math.hypot(c.pos.x - x, c.pos.z - z)).toBeLessThan(0.01);
    }
    stage.dispose();
  });

  for (const [name, w, h] of [['태블릿 가로', 1024, 768], ['휴대폰 세로', 390, 844], ['휴대폰 가로', 844, 390]] as const) {
    it(`${name}: 마지막 장면에서 모두의 얼굴이 화면 안, 아래쪽 카드보다 위에 보인다`, () => {
      const stage = new EndingStage();
      stage.resize(w, h);
      stage.finale();
      for (let i = 0; i < 200; i++) stage.update(1 / 20);
      stage.camera.updateMatrixWorld();
      for (const c of stage.snapshot().cast) {
        const head = c.pos.clone().setY(c.pos.y + 1.6).project(stage.camera);
        expect(Math.abs(head.x), c.id).toBeLessThan(0.97);
        expect(head.y, c.id).toBeLessThan(0.97);
        // 카드는 화면 아래쪽 절반 남짓을 덮는다
        expect(head.y, c.id).toBeGreaterThan(h < w && h < 500 ? -0.2 : 0);
      }
      stage.dispose();
    });
  }
});
