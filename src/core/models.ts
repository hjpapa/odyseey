/** 모델 가져오기 — Codex 등록부에 있으면 진짜 모델, 없으면 임시 블록 */
import type { Group } from 'three';
import type { ModelId, ModelOptions } from '../types/contracts';
import { modelRegistry } from '../models/registry';
import { placeholderModel } from './placeholders';

export function hasRealModel(id: ModelId): boolean {
  return typeof modelRegistry[id] === 'function';
}

export function getModel(id: ModelId, opts?: ModelOptions): Group {
  const builder = modelRegistry[id];
  const group = builder ? builder(opts) : placeholderModel(id, opts);
  group.userData.modelId = id;
  group.userData.placeholder = !builder;
  return group;
}
