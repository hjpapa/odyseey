import { Group } from 'three';
import { DEFAULT_AVATAR, type HumanoidId, type ModelOptions } from '../types/contracts';
import { palette as P } from './palette';
import { block, face, finish, joint } from './parts';
import { helmet, weapon } from './equipment';

const clothing: Record<HumanoidId, string> = {
  odysseus: P.blue, crewman: P.sea, telemachus: P.leaf, athena: P.cream, hermes: P.sand,
  calypso: P.sea, ino: P.white, aeolus: P.blue, circe: P.purple, tiresias: P.marble,
  nausicaa: P.rose, alcinous: P.purple, penelope: P.coral, eumaeus: P.wood,
  poseidon: P.sea, helios: P.gold, polyphemus: P.woodLight, lotusEater: P.rose,
  lotusKing: P.purple, laestrygonian: P.leaf, laestrygonianKing: P.coral,
  siren: P.sea, sirenQueen: P.purple, greekSoldier: P.stone, soldierCaptain: P.blue,
  suitor: P.purple, antinous: P.coral,
};
const heights: Partial<Record<HumanoidId, number>> = { odysseus: 2.1, crewman: 1.95, telemachus: 1.85, poseidon: 8, helios: 8, polyphemus: 6.1, laestrygonian: 4.2, laestrygonianKing: 6.4 };
const variants = [P.sea, P.coral, P.leaf, P.purple];
const royals: HumanoidId[] = ['alcinous', 'antinous', 'lotusKing', 'laestrygonianKing', 'sirenQueen'];
const longHair: HumanoidId[] = ['athena', 'calypso', 'ino', 'circe', 'nausicaa', 'penelope', 'siren', 'sirenQueen'];

export function humanoid(id: HumanoidId, opts: ModelOptions = {}): Group {
  const rig = new Group();
  const avatar = opts.avatar ?? DEFAULT_AVATAR;
  const variant = ((Math.trunc(opts.variant ?? 0) % 4) + 4) % 4;
  const shirt = id === 'odysseus' ? avatar.tunicColor : ['crewman', 'suitor', 'greekSoldier', 'lotusEater'].includes(id) ? variants[variant] : clothing[id];
  const skin = ['eumaeus', 'laestrygonian', 'laestrygonianKing'].includes(id) ? P.skinDark : P.skin;
  const hair = ['tiresias', 'poseidon', 'aeolus'].includes(id) ? P.white : id === 'helios' ? P.gold : P.hair;
  const torso = joint(rig, 'torso', 0, .73);
  block(torso, [.72, .66, .42], [0, .33, 0], shirt);
  block(torso, [.77, .12, .46], [0, .12, 0], P.wood);
  block(torso, [.15, .14, .055], [0, .12, .25], P.gold);
  block(torso, [.85, .22, .48], [0, -.06, 0], shirt);
  const back = joint(torso, 'back', 0, .58, -.25);
  for (const side of [-1, 1]) {
    const leg = joint(rig, side === 1 ? 'legL' : 'legR', side * .21, .73);
    block(leg, [.31, .59, .34], [0, -.3, 0], skin);
    block(leg, [.35, .14, .46], [0, -.66, .04], P.wood);
    block(leg, [.34, .07, .36], [0, -.51, 0], P.woodLight);
    const arm = joint(torso, side === 1 ? 'armL' : 'armR', side * .53, .61);
    block(arm, [.3, .25, .38], [0, -.1, 0], shirt);
    block(arm, [.25, .38, .29], [0, -.39, 0], skin);
    block(arm, [.28, .15, .31], [0, -.59, 0], skin);
    joint(arm, side === 1 ? 'handL' : 'handR', 0, -.62, .05);
  }
  const head = joint(torso, 'head', 0, .68);
  block(head, [.66, .58, .57], [0, .29, 0], skin);
  block(head, [.7, .14, .61], [0, .6, -.02], hair);
  if (longHair.includes(id)) block(head, [.69, .5, .15], [0, .25, -.31], hair);
  face(head, .34, .3, .65, id === 'polyphemus');
  const top = joint(head, 'headTop', 0, .68);
  const handR = rig.getObjectByName('handR')!, handL = rig.getObjectByName('handL')!;
  const equip = (kind: Parameters<typeof weapon>[0], left = false, color: string = P.gold) => {
    const item = weapon(kind, color);
    item.scale.setScalar(kind === 'trident' || kind === 'caduceus' ? .95 : .65);
    item.position.z = .25;
    if (!left) item.rotation.z = .22;
    (left ? handL : handR).add(item); return item;
  };
  const crown = () => {
    block(top, [.7, .12, .58], [0, .03, 0], P.gold);
    for (const x of [-.26, 0, .26]) block(top, [.1, .19, .1], [x, .17, .23], P.gold);
  };
  if (id === 'odysseus') {
    if (avatar.helmet !== 'none') top.add(helmet(avatar.helmet));
    if (avatar.capeColor) {
      block(back, [.74, .8, .055], [0, -.38, -.06], avatar.capeColor).rotation.x = -.12;
    }
    equip('shield', true, avatar.shieldColor); equip('sword');
  }
  if (id === 'athena') { top.add(helmet('owl')); equip('shield', true); equip('wand'); }
  if (id === 'hermes') {
    block(top, [.82, .08, .64], [0, .02, 0], P.sand);
    block(top, [.46, .15, .46], [0, .12, 0], P.sand);
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) block(top, [.16, .08, .12], [side * (.42 + i * .07), .09 + i * .07, 0], P.white);
    equip('caduceus');
  }
  if (['calypso', 'lotusEater', 'lotusKing'].includes(id)) {
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      block(top, [.19, .13, .22], [Math.cos(a) * .24, .06, Math.sin(a) * .24], P.rose).rotation.y = -a;
    }
    block(top, [.13, .14, .13], [0, .12, 0], P.gold);
  }
  if (id === 'ino') {
    block(torso, [.8, .12, .5], [0, .57, 0], P.white);
    block(torso, [.14, .6, .06], [-.24, .21, .27], P.white);
  }
  if (id === 'aeolus') {
    for (const x of [-.4, -.2, 0, .2, .4]) block(top, [.22, .15, .28], [x, .05 + Math.abs(x) * .1, 0], P.white);
    block(handL, [.35, .42, .3], [0, -.05, 0], P.blue);
    block(handL, [.39, .06, .32], [0, .1, 0], P.gold);
  }
  if (id === 'circe') {
    for (let i = 0; i < 3; i++) block(top, [.6 - i * .16, .16, .5 - i * .13], [0, i * .14, 0], P.purple);
    equip('wand');
  }
  if (id === 'tiresias' || id === 'eumaeus') {
    block(handR, [.07, 1.35, .07], [-.08, .05, .3], P.woodLight);
    block(handR, [.22, .07, .07], [-.01, .72, .3], P.woodLight);
  }
  if (['tiresias', 'poseidon', 'eumaeus', 'polyphemus'].includes(id)) block(head, [.4, .18, .1], [0, .07, .29], hair);
  if (id === 'nausicaa') block(handL, [.32, .32, .32], [0, .1, .3], P.coral);
  if (id === 'penelope') {
    block(back, [.88, .54, .07], [0, -.23, -.03], P.purple);
    for (const x of [-.32, -.16, 0, .16, .32]) block(back, [.04, .58, .03], [x, -.24, -.08], P.gold);
    block(handL, [.07, .4, .07], [0, .1, 0], P.woodLight);
    block(handL, [.2, .17, .15], [0, .1, 0], P.cream);
  }
  if (id === 'poseidon') { crown(); equip('trident'); }
  if (id === 'helios') {
    for (let i = 0; i < 9; i++) {
      const a = i * Math.PI * 2 / 9;
      block(head, [.1, .22, .08], [Math.sin(a) * .47, .35 + Math.cos(a) * .47, -.1], P.gold, true).rotation.z = -a;
    }
  }
  if (royals.includes(id)) crown();
  if (['greekSoldier', 'soldierCaptain', 'antinous', 'telemachus'].includes(id)) {
    if (id !== 'antinous') top.add(helmet(id === 'soldierCaptain' ? 'crested' : 'bronze'));
    equip('sword'); equip('shield', true, shirt);
    block(torso, [.54, .38, .08], [0, .36, .25], P.bronze);
  }
  if (id === 'siren' || id === 'sirenQueen') {
    for (const side of [-1, 1]) {
      const wing = joint(back, side === 1 ? 'wingL' : 'wingR', side * .35, -.1);
      for (let i = 0; i < 3; i++) block(wing, [.2, .53 - i * .1, .11], [side * (.1 + i * .14), -.1 - i * .06, 0], P.sea).rotation.z = side * -.3;
    }
    block(handR, [.08, .65, .08], [0, .16, .03], P.gold);
  }
  if (id === 'crewman') block(top, [.7, .1, .61], [0, 0, 0], P.cream);
  return finish(rig, id, heights[id] ?? 2.05);
}
