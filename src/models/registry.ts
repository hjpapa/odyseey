/** Shared-material block builders for every contracted ModelId. */
import { CREATURE_IDS, HUMANOID_IDS, PROP_IDS, type ModelOptions, type ModelRegistry } from '../types/contracts';
import { humanoid } from './humanoids';
import { creature } from './creatures';
import { prop } from './props';

export const modelRegistry = Object.fromEntries([
  ...HUMANOID_IDS.map(id => [id, (opts?: ModelOptions) => humanoid(id, opts)]),
  ...CREATURE_IDS.map(id => [id, () => creature(id)]),
  ...PROP_IDS.map(id => [id, () => prop(id)]),
]) as ModelRegistry;
