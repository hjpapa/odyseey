/**
 * 블록 모델 등록부 — ModelId 91개 전부.
 * - 사람형 27·동물/괴물 9·장비 7: 그리스 신화 캐릭터 세트 (humanoids/creatures/equipment, PR #2)
 * - 나머지 소품 48: 배경 소품 세트 (props, PR #1)
 */
import { CREATURE_IDS, HUMANOID_IDS, PROP_IDS, type ModelBuilder, type ModelRegistry } from '../types/contracts';
import { humanoid } from './humanoids';
import { creature } from './creatures';
import { arrow, bow, caduceus, shield, sword, trident, wand } from './equipment';
import { prop } from './props';

const equipment: Partial<Record<(typeof PROP_IDS)[number], ModelBuilder>> = {
  sword, shield: opts => shield(opts?.avatar?.shieldColor), bow, arrow, trident, caduceus, wand,
};

export const modelRegistry = {} as ModelRegistry;
for (const id of PROP_IDS) modelRegistry[id] = equipment[id] ?? (() => prop(id));
for (const id of HUMANOID_IDS) modelRegistry[id] = opts => humanoid(id, opts);
for (const id of CREATURE_IDS) modelRegistry[id] = () => creature(id);
