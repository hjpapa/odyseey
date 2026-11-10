/**
 * 간단한 몸 물리 — 블록 지형 위를 걷고(0.6m 이하 턱은 자동으로 오름), 점프하고, 기둥에 부딪힌다.
 */
import { Vector3 } from 'three';
import type { IslandWorld } from '../world/island';

export const GRAVITY = 28;
export const STEP_UP = 0.6;

export interface Body {
  pos: Vector3;
  vy: number;
  grounded: boolean;
  radius: number;
}

export function makeBody(x: number, y: number, z: number, radius: number): Body {
  return { pos: new Vector3(x, y, z), vy: 0, grounded: true, radius };
}

const prev = new Vector3();

/** dx, dz 만큼 옮기고 중력 적용. 땅에 막 닿으면 true */
export function stepBody(b: Body, dx: number, dz: number, dt: number, world: IslandWorld): boolean {
  const canStand = (x: number, z: number) => world.terrain.isLand(x, z) && world.ground(x, z) - b.pos.y <= STEP_UP;
  if (dx && canStand(b.pos.x + dx, b.pos.z)) b.pos.x += dx;
  if (dz && canStand(b.pos.x, b.pos.z + dz)) b.pos.z += dz;
  prev.copy(b.pos);
  if (world.resolve(b.pos, b.radius) && !canStand(b.pos.x, b.pos.z)) b.pos.copy(prev);

  const g = world.ground(b.pos.x, b.pos.z);
  const wasGrounded = b.grounded;
  if (b.grounded && b.vy <= 0 && b.pos.y - g <= STEP_UP + 0.05) {
    b.pos.y = g;
    b.vy = 0;
    return false;
  }
  b.vy -= GRAVITY * dt;
  b.pos.y += b.vy * dt;
  if (b.pos.y <= g) {
    b.pos.y = g;
    const landed = !wasGrounded;
    b.vy = 0;
    b.grounded = true;
    return landed;
  }
  b.grounded = false;
  return false;
}
