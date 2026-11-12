/**
 * 사람형 리그 절차 애니메이션 — 걷기·점프·칼 휘두르기·손 흔들기.
 * 리그 규약(contracts.ts 7장)의 부위 이름만 있으면 어떤 모델이든 움직인다.
 */
import type { Object3D } from 'three';

export interface RigPose {
  /** 0~1 이동 속도 비율 */
  speed: number;
  grounded: boolean;
  /** 휘두르기 진행 0~1 (없으면 null) */
  swing: number | null;
  /** 0 내려치기, 1 옆으로 베기, 2 회전 베기 */
  combo: number;
  /** 0~1 공격 준비(팔 들기) */
  windup?: number;
  wave?: boolean;
  talk?: boolean;
  /** 지친 자세 (보스 약점) — 고개 숙이고 팔 늘어뜨림 */
  tired?: boolean;
}

const ease = (t: number) => 1 - (1 - t) * (1 - t);

export class HumanoidRig {
  private p: Record<'torso' | 'head' | 'armL' | 'armR' | 'legL' | 'legR', Object3D | undefined>;
  private phase = 0;
  private time = 0;

  constructor(model: Object3D) {
    const get = (n: string) => model.getObjectByName(n) ?? undefined;
    this.p = { torso: get('torso'), head: get('head'), armL: get('armL'), armR: get('armR'), legL: get('legL'), legR: get('legR') };
  }

  /** 몸 전체 회전 오프셋(회전 베기 등)을 돌려준다 */
  update(dt: number, pose: RigPose): { bodyYaw: number } {
    const { torso, head, armL, armR, legL, legR } = this.p;
    this.time += dt;
    const moving = pose.speed > 0.05;
    this.phase += dt * (moving ? 7 + 6 * pose.speed : 0);
    const s = Math.sin(this.phase);
    const amp = moving ? pose.speed : 0;
    let bodyYaw = 0;

    let lx = s * 0.9 * amp;
    let rx = -s * 0.9 * amp;
    let alx = -s * 0.7 * amp;
    let arx = s * 0.7 * amp;
    let alz = 0;
    let arz = 0;
    if (!pose.grounded) {
      lx = -0.6;
      rx = 0.35;
      alx = -0.9;
      arx = -0.9;
      alz = 0.3;
      arz = -0.3;
    }
    if (pose.windup !== undefined && pose.windup > 0) {
      arx = -2.8 * Math.min(1, pose.windup * 1.5);
    }
    if (pose.swing !== null) {
      const t = ease(Math.min(1, pose.swing));
      if (pose.combo === 0) {
        arx = -2.8 + 2.6 * t;
      } else if (pose.combo === 1) {
        arx = -1.5;
        bodyYaw = 0.9 - 1.8 * t;
      } else {
        arx = -1.6;
        alx = -1.2;
        bodyYaw = -Math.PI * 2 * t;
      }
    }
    if (pose.wave) {
      alx = -2.7;
      alz = Math.sin(this.time * 7) * 0.3;
    }
    if (legL) legL.rotation.x = lx;
    if (legR) legR.rotation.x = rx;
    if (armL) armL.rotation.set(alx, 0, alz);
    if (armR) armR.rotation.set(arx, 0, arz);
    if (pose.tired) {
      if (armL) armL.rotation.set(0.35, 0, 0.15);
      if (armR) armR.rotation.set(0.35, 0, -0.15);
    }
    if (head) {
      head.rotation.x = pose.tired
        ? 0.45 + Math.sin(this.time * 2) * 0.05
        : pose.talk ? Math.sin(this.time * 9) * 0.08 : Math.sin(this.time * 1.6) * 0.03;
    }
    if (torso) torso.rotation.y = pose.swing !== null && pose.combo === 0 ? -0.2 : 0;
    return { bodyYaw };
  }
}
