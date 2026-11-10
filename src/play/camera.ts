/**
 * 3인칭 따라가기 카메라 — 드래그로 돌리고, 움직이면 천천히 등 뒤로 돌아온다.
 * yaw 0 = 카메라가 -Z 쪽에서 +Z 를 바라봄. 앞 방향 = (sin yaw, cos yaw)
 */
import { MathUtils, type PerspectiveCamera, Vector3 } from 'three';
import type { InputFrame } from '../core/input';

export class FollowCamera {
  yaw = 0;
  pitch = 0.42;
  distance = 10;
  private target = new Vector3();
  private manualTimer = 0;
  private ready = false;

  constructor(readonly camera: PerspectiveCamera) {}

  forward(out = new Vector3()) {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  right(out = new Vector3()) {
    return out.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
  }

  /** 바로 그 자리로 (장면 시작·순간이동) */
  snap(focus: Vector3, yaw?: number) {
    if (yaw !== undefined) this.yaw = yaw;
    this.target.copy(focus);
    this.ready = false;
  }

  update(dt: number, focus: Vector3, input: InputFrame | null, heading: number | null, groundAt: (x: number, z: number) => number) {
    if (input) {
      if (input.camDX || input.camDY) {
        this.yaw -= input.camDX * 0.006;
        this.pitch = MathUtils.clamp(this.pitch + input.camDY * 0.004, 0.12, 1.2);
        this.manualTimer = 1.6;
      }
      if (input.zoom) this.distance = MathUtils.clamp(this.distance + input.zoom * 0.8, 5, 18);
    }
    this.manualTimer -= dt;
    // 이동 중이면 천천히 플레이어 등 뒤로 (뒤로 걸을 때는 돌리지 않음)
    if (heading !== null && this.manualTimer <= 0) {
      let diff = heading - this.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) < 2.2) this.yaw += diff * Math.min(1, dt * 0.9);
    }
    const k = this.ready ? 1 - Math.exp(-dt * 8) : 1;
    this.target.lerp(focus, k);
    const cp = Math.cos(this.pitch);
    const pos = this.camera.position;
    const want = new Vector3(
      this.target.x - Math.sin(this.yaw) * cp * this.distance,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z - Math.cos(this.yaw) * cp * this.distance,
    );
    const minY = groundAt(want.x, want.z) + 0.8;
    if (want.y < minY) want.y = minY;
    if (this.ready) pos.lerp(want, 1 - Math.exp(-dt * 10));
    else pos.copy(want);
    this.ready = true;
    this.camera.lookAt(this.target);
  }
}
