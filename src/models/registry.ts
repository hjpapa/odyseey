/** Characters and their equipment. World props still use the engine's fallback. */
import { CREATURE_IDS, HUMANOID_IDS, type ModelRegistry } from '../types/contracts';
import { humanoid } from './humanoids';
import { creature } from './creatures';
import { arrow, bow, caduceus, shield, sword, trident, wand } from './equipment';

export const modelRegistry: Partial<ModelRegistry> = {
  sword, shield: opts => shield(opts?.avatar?.shieldColor), bow, arrow, trident, caduceus, wand,
};
for (const id of HUMANOID_IDS) modelRegistry[id] = opts => humanoid(id, opts);
for (const id of CREATURE_IDS) modelRegistry[id] = () => creature(id);
