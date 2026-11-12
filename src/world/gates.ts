/** 지혜의 문 — 충돌체 배치와 모습. 섬(IslandStage)·바다(SeaStage)·도달 가능성 테스트가 함께 쓴다 */
import { Box3, BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import type { XZ } from '../types/contracts';
import { makeProp } from './props';

/** 지혜의 문 폭 — 기둥 충돌체(±2.25)와 섬 데이터의 바위 울타리가 이 폭을 기준으로 맞춰져 있다 */
export const GATE_WIDTH = 5.6;

export interface GateColliderSpec {
  x: number;
  z: number;
  r: number;
  /** true 면 문이 열릴 때 사라지는 막 */
  barrier: boolean;
}

/** 양옆 기둥(±2.25m)과 가운데 막(−1.2·0·1.2m). 문 앞면(+Z)은 rotY 방향 */
export function gateColliders(pos: XZ, rotY: number): GateColliderSpec[] {
  const ax = Math.cos(rotY);
  const az = -Math.sin(rotY);
  const at = (s: number, r: number, barrier: boolean): GateColliderSpec => ({ x: pos[0] + ax * s, z: pos[1] + az * s, r, barrier });
  return [at(-2.25, 0.6, false), at(2.25, 0.6, false), at(-1.2, 0.85, true), at(0, 0.85, true), at(1.2, 0.85, true)];
}

/**
 * 지혜의 문 모습: 어떤 모델이든 정해진 폭으로 맞추고, 닫힘을 보여 주는 'barrier' 막이 없으면 붙인다.
 * (barrier 는 문이 열릴 때 숨긴다) — 바다 위 문은 width 를 물길 폭으로 넓힌다
 */
export function buildGate(width = GATE_WIDTH): Group {
  const model = makeProp('wisdomGate');
  const modelWidth = new Box3().setFromObject(model).getSize(new Vector3()).x;
  if (modelWidth > 0.5 && Math.abs(modelWidth - width) > 0.3) model.scale.setScalar(width / modelWidth);
  const gate = new Group();
  gate.add(model);
  if (!model.getObjectByName('barrier')) {
    const pane = new Mesh(
      new BoxGeometry(width * 0.62, 3.4, 0.12),
      new MeshBasicMaterial({ color: '#7fd3ff', transparent: true, opacity: 0.45, depthWrite: false }),
    );
    pane.name = 'barrier';
    pane.position.y = 1.75;
    gate.add(pane);
  }
  return gate;
}

/** 바닥에 까는 빛나는 고리 */
export function glowRing(radius: number, color: string): Mesh {
  const ring = new Mesh(
    new CylinderGeometry(radius, radius, 0.05, 24),
    new MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  ring.name = 'glow';
  return ring;
}
