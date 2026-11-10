/** Twelve instrumental modal scores, with 16-bar loops and a homeward cadence. */
import type { BgmId, BgmTrack } from '../../types/contracts';

import { title } from './title';
import { sailing } from './sailing';
import { memorySea } from './memorySea';
import { island } from './island';
import { cave } from './cave';
import { shadow } from './shadow';
import { boss } from './boss';
import { siren } from './siren';
import { ithaca } from './ithaca';
import { palace } from './palace';
import { finalBoss } from './finalBoss';
import { ending } from './ending';

export const bgmTracks: Record<BgmId, BgmTrack> = {
  title, sailing, memorySea, island, cave, shadow, boss, siren, ithaca, palace, finalBoss, ending,
};
