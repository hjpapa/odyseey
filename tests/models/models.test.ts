// 모델 리그 검사 (항상 통과해야 함). 전 모델 완성은 models.accept.test.ts 에서.
import { describe, expect, it } from 'vitest';
import { modelRegistry } from '../../src/models/registry';
import { placeholderModel } from '../../src/core/placeholders';
import type { ModelId } from '../../src/types/contracts';
import { MODEL_IDS, has, validateModel } from '../helpers/validate';

describe('등록된 블록 모델', () => {
  it('키는 ModelId 이고, 리그·크기 규약을 지킨다', () => {
    const errors: string[] = [];
    for (const [id, build] of Object.entries(modelRegistry)) {
      if (!has(MODEL_IDS, id)) {
        errors.push(`알 수 없는 모델 '${id}'`);
        continue;
      }
      const a = build!();
      const b = build!();
      if (a === b) errors.push(`model[${id}]: 호출마다 새 Group 을 만들어야 함`);
      errors.push(...validateModel(id as ModelId, a));
    }
    expect(errors).toEqual([]);
  });
});

describe('임시 블록(대역) 모델', () => {
  it('모든 ModelId 에 대해 규약을 지킨다 (리그 참고 구현)', () => {
    const errors = MODEL_IDS.flatMap((id) => validateModel(id, placeholderModel(id)));
    expect(errors).toEqual([]);
  });
});
