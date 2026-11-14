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

/**
 * 동물 리그 — 네 발(leg0 앞왼·leg1 앞오·leg2 뒤왼·leg3 뒤오)은 대각선끼리 함께 걷고,
 * 꼬리(tail)는 흔들고, 날개(wingL·wingR)는 파닥인다. 부위가 없으면 그 부분만 건너뛴다.
 */
export class CreatureRig {
  private legs: Object3D[];
  private wings: { part: Object3D; side: number }[];
  private tail: Object3D | undefined;
  private head: Object3D | undefined;
  private phase = 0;
  private time = 0;
  private stride = 0;

  constructor(model: Object3D) {
    this.legs = [0, 1, 2, 3].map((i) => model.getObjectByName(`leg${i}`)).filter((o): o is Object3D => !!o);
    this.wings = (['wingL', 'wingR'] as const)
      .map((n, i) => ({ part: model.getObjectByName(n), side: i === 0 ? 1 : -1 }))
      .filter((w): w is { part: Object3D; side: number } => !!w.part);
    this.tail = model.getObjectByName('tail') ?? undefined;
    this.head = model.getObjectByName('head') ?? undefined;
  }

  update(dt: number, pose: RigPose): { bodyYaw: number } {
    this.time += dt;
    const moving = pose.speed > 0.05;
    this.phase += dt * (moving ? 9 + 7 * Math.min(1, pose.speed) : 0);
    // 멈추면 다리가 툭 끊기지 않고 천천히 모인다
    const target = moving ? 0.45 + 0.25 * Math.min(1, pose.speed) : 0;
    this.stride += (target - this.stride) * Math.min(1, dt * 10);
    const s = Math.sin(this.phase) * this.stride;
    this.legs.forEach((leg, i) => {
      leg.rotation.x = i === 0 || i === 3 ? s : -s;
    });
    if (this.tail) this.tail.rotation.y = Math.sin(this.time * (moving ? 12 : 5)) * (moving ? 0.45 : 0.25);
    if (this.head) {
      this.head.rotation.x = pose.tired
        ? 0.4
        : moving ? Math.abs(Math.sin(this.phase)) * 0.08 : Math.sin(this.time * 1.3) * 0.05;
    }
    const flap = !pose.grounded || moving ? 0.25 + Math.sin(this.time * 16) * 0.55 : Math.sin(this.time * 2) * 0.06;
    for (const w of this.wings) w.part.rotation.z = w.side * flap;
    return { bodyYaw: 0 };
  }
}

/** 모델 부위를 보고 사람형·동물 리그 중 맞는 것을 고른다 */
export function createRig(model: Object3D): HumanoidRig | CreatureRig {
  const creature = !!model.getObjectByName('leg0') || (!!model.getObjectByName('wingL') && !model.getObjectByName('legL'));
  return creature ? new CreatureRig(model) : new HumanoidRig(model);
}
