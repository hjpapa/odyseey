/**
 * 화면 방향 검사 — ◀(왼쪽) 버튼을 누르면 화면에서도 왼쪽으로 가야 한다.
 * 카메라가 +z 쪽을 바라보면 화면 왼쪽이 +x 라서, x 를 작은 순서로 줄을 놓으면 좌우가 뒤집힌다 (P5 에서 고친 버그).
 */
import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { seaCameraPose, seaLanes } from '../../src/game/seaStage';
import { laneX } from '../../src/story/minigames/rhythmShield';
import { slotPos } from '../../src/story/minigames/hideWeapons';

/** 그 점이 화면 어디에 보이는가 (x: 왼쪽 -1 ~ 오른쪽 1, y: 아래 -1 ~ 위 1) */
function onScreen(cam: PerspectiveCamera, p: Vector3) {
  cam.updateMatrixWorld();
  const v = p.clone().project(cam);
  return { x: v.x, y: v.y };
}

function camera(aspect: number, pos: Vector3, look: Vector3) {
  // 장 카메라와 같은 화각 (세로 화면은 더 넓게)
  const cam = new PerspectiveCamera(aspect < 1 ? 68 : 55, aspect, 0.1, 1200);
  cam.position.copy(pos);
  cam.lookAt(look);
  return cam;
}

const SCREENS = [['태블릿 가로', 1024 / 768], ['휴대폰 세로', 390 / 844], ['휴대폰 가로', 844 / 390]] as const;

describe('바다 조종 — 화면 방향', () => {
  for (const [name, aspect] of SCREENS) {
    for (const sail of [false, true]) {
      it(`${name} · ${sail ? '항해(10장)' : '러너(2장)'}: 0번 줄(◀)은 화면 왼쪽, 2번 줄(▶)은 오른쪽`, () => {
        const lanes = seaLanes(sail ? 5.28 : 4);
        const pos = new Vector3();
        const look = new Vector3();
        seaCameraPose(0, 0, 100, aspect, sail, pos, look);
        const cam = camera(aspect, pos, look);
        const ahead = 118;
        const [l, m, r] = lanes.map((x) => onScreen(cam, new Vector3(x, 0, ahead)).x);
        expect(l).toBeLessThan(m);
        expect(m).toBeLessThan(r);
        // 앞쪽 세 줄이 모두 화면 안에 보인다
        expect(l).toBeGreaterThan(-1);
        expect(r).toBeLessThan(1);
      });
    }

    it(`${name}: ◀ 로 옮기면 뗏목이 화면 왼쪽으로 간다`, () => {
      const lanes = seaLanes(4);
      const pos = new Vector3();
      const look = new Vector3();
      seaCameraPose(lanes[0], 0, 100, aspect, false, pos, look);
      const cam = camera(aspect, pos, look);
      expect(onScreen(cam, new Vector3(lanes[0], 1, 100)).x).toBeLessThan(-0.02);
    });

    it(`${name}: 뗏목 바로 앞 장애물이 오디세우스에 가리지 않을 만큼 화면 위쪽에 보인다`, () => {
      const pos = new Vector3();
      const look = new Vector3();
      seaCameraPose(0, 0, 100, aspect, false, pos, look);
      const cam = camera(aspect, pos, look);
      const head = onScreen(cam, new Vector3(0, 2.6, 99.4)).y;
      const rock = onScreen(cam, new Vector3(0, 0.6, 112)).y;
      expect(rock).toBeGreaterThan(head);
    });
  }
});

describe('미니게임 — 버튼과 3D 의 좌우가 같다', () => {
  it('리듬 방패(11장): ← 왼쪽 줄은 화면 왼쪽', () => {
    // rhythmShield 의 카메라 자리 (at 기준)
    const cam = camera(4 / 3, new Vector3(0.8, 8, -10), new Vector3(0, 1.1, 1.4));
    const [l, m, r] = [0, 1, 2].map((lane) => onScreen(cam, new Vector3(laneX(lane), 1.25, 1)).x);
    expect(l).toBeLessThan(m);
    expect(m).toBeLessThan(r);
  });

  it('무기 정리(15장): 버튼 칸의 순서(왼→오, 위→아래)대로 진열대에 놓인다', () => {
    // hideWeapons 의 카메라 자리 (at 기준)
    const cam = camera(4 / 3, new Vector3(5, 8, -8), new Vector3(0, 0.3, 0.5));
    const at = (i: number) => onScreen(cam, new Vector3(...slotPos(i)));
    expect(at(0).x).toBeLessThan(at(1).x);
    expect(at(1).x).toBeLessThan(at(2).x);
    expect(at(3).x).toBeLessThan(at(5).x);
    // 첫째 줄(0~2)이 둘째 줄(3~5)보다 화면 위쪽
    expect(at(0).y).toBeGreaterThan(at(3).y);
  });
});
