/** 말 거는 사람 — 가까이 오면 플레이어 쪽을 보고, 할 일이 있으면 ❗ 표시 */
import { Group, type Vector3 } from 'three';
import type { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { ModelId } from '../types/contracts';
import { getModel } from '../core/models';
import { SPEAKERS } from '../story/speakers';
import { HumanoidRig } from './rig';
import { label } from './effects';

export class Npc {
  readonly root = new Group();
  readonly model: Group;
  private rig: HumanoidRig;
  private tag: CSS2DObject;
  private baseYaw: number;
  talking = false;
  waving = false;

  constructor(readonly id: string, modelId: ModelId, pos: Vector3, rotY: number) {
    this.model = getModel(modelId);
    this.root.add(this.model);
    this.root.position.copy(pos);
    this.root.rotation.y = rotY;
    this.baseYaw = rotY;
    this.rig = new HumanoidRig(this.model);
    const name = SPEAKERS[modelId as keyof typeof SPEAKERS]?.name ?? id;
    this.tag = label(name);
    this.tag.position.y = ((this.model.userData.height as number) || 2) + 0.5;
    this.root.add(this.tag);
  }

  get pos() {
    return this.root.position;
  }

  setQuest(on: boolean) {
    this.tag.element.classList.toggle('quest', on);
  }

  update(dt: number, playerPos: Vector3) {
    const dx = playerPos.x - this.root.position.x;
    const dz = playerPos.z - this.root.position.z;
    const d2 = dx * dx + dz * dz;
    const near = d2 < 36;
    // 멀리 있는 이름표는 숨긴다 (할 일이 있는 사람은 조금 더 멀리서도 보이게)
    this.tag.visible = d2 < (this.tag.element.classList.contains('quest') ? 45 * 45 : 22 * 22);
    const want = near ? Math.atan2(dx, dz) : this.baseYaw;
    let diff = want - this.root.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.root.rotation.y += diff * Math.min(1, dt * 4);
    this.rig.update(dt, { speed: 0, grounded: true, swing: null, combo: 0, wave: this.waving, talk: this.talking });
  }

  dispose() {
    this.tag.element.remove();
  }
}
