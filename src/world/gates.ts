/** 지혜의 문 충돌체 배치 — 게임 엔진과 도달 가능성 테스트가 같은 값을 쓴다 */
import type { XZ } from '../types/contracts';

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
