/**
 * [Codex A4] 블록 모델 등록부 — ModelId 전부 채우기.
 * 비어 있는 모델은 엔진이 임시 블록(src/core/placeholders.ts)으로 대신 보여 줍니다.
 */
import type { ModelRegistry } from '../types/contracts';

export const modelRegistry: Partial<ModelRegistry> = {};
