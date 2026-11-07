import { Group } from 'three';
import type { CreatureId } from '../types/contracts';
import { palette as P } from './palette';
import { block, face, finish, joint } from './parts';

export function creature(id: CreatureId): Group {
  const rig = new Group();
  if (id === 'scylla') {
    const body = joint(rig, 'body', 0, 1.1);
    block(body, [3.4, 2.2, 2.5], [0, 0, 0], P.sea);
    block(body, [2.6, 1.3, .15], [0, -.1, 1.3], P.cream);
    for (let i = 0; i < 6; i++) {
      const x = (i % 3 - 1) * 1.25, z = i < 3 ? .85 : -.85, h = i < 3 ? 2.6 : 3.8;
      const neck = joint(body, 'neck' + i, x, .8, z);
      block(neck, [.52, h, .55], [0, h / 2, 0], i % 2 ? P.leafLight : P.sea);
      const head = joint(neck, 'head' + i, 0, h);
      block(head, [1.08, .8, 1], [0, .35, 0], i % 2 ? P.leafLight : P.sea);
      block(head, [.8, .25, .5], [0, .12, .5], P.cream);
      face(head, .48, .53, 1);
      for (const side of [-1, 1]) block(head, [.2, .2, .2], [side * .4, .82, -.1], P.purple);
    }
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) block(body, [.6, .4, 1], [side * 1.4, -.9, (i - 1) * 1.1], P.sea);
    return finish(rig, id, 6.8);
  }
  if (id === 'athenaOwl' || id === 'seagull') {
    const owl = id === 'athenaOwl';
    const body = joint(rig, 'body', 0, .35);
    block(body, [owl ? .48 : .4, .4, owl ? .38 : .7], [0, 0, 0], owl ? P.woodLight : P.white);
    block(body, [.32, .28, .08], [0, -.03, .2], P.cream);
    const head = joint(body, 'head', 0, .2, owl ? .02 : .3);
    block(head, [owl ? .53 : .3, owl ? .36 : .28, .32], [0, .12, 0], owl ? P.woodLight : P.white);
    if (owl) {
      for (const side of [-1, 1]) {
        block(head, [.21, .23, .04], [side * .13, .15, .18], P.cream);
        block(head, [.09, .12, .04], [side * .13, .15, .21], P.ink);
        block(head, [.12, .15, .15], [side * .2, .34, 0], P.wood).rotation.z = side * -.25;
      }
    } else {
      for (const side of [-1, 1]) block(head, [.03, .06, .06], [side * .16, .16, .1], P.ink);
    }
    block(head, [.12, .08, owl ? .09 : .26], [0, .04, .22], P.gold);
    for (const side of [-1, 1]) {
      const wing = joint(body, side === 1 ? 'wingL' : 'wingR', side * .23, .1);
      if (owl) block(wing, [.12, .38, .29], [side * .04, -.14, 0], P.wood);
      else {
        block(wing, [.46, .06, .35], [side * .21, 0, 0], P.white);
        block(wing, [.25, .05, .25], [side * .55, -.01, -.08], P.ink);
      }
      block(rig, [.12, .08, .19], [side * .13, .04, .09], P.gold);
    }
    return finish(rig, id, owl ? .7 : .65);
  }
  if (id === 'dolphin') {
    const body = joint(rig, 'body', 0, .5);
    block(body, [.54, .55, 1.3], [0, 0, 0], P.sea);
    block(body, [.44, .2, 1.12], [0, -.18, .06], P.cream);
    block(body, [.3, .2, .52], [0, -.07, .82], P.sea);
    block(body, [.1, .33, .35], [0, .38, -.13], P.blue).rotation.x = -.3;
    for (const side of [-1, 1]) {
      block(body, [.36, .07, .38], [side * .4, -.1, .15], P.blue).rotation.z = side * -.3;
      block(body, [.045, .07, .1], [side * .28, .08, .5], P.ink);
    }
    const tail = joint(body, 'tail', 0, 0, -.7);
    block(tail, [.28, .25, .6], [0, 0, -.25], P.sea);
    for (const side of [-1, 1]) block(tail, [.4, .08, .24], [side * .22, 0, -.56], P.blue).rotation.y = side * -.3;
    return finish(rig, id, .85);
  }
  const sheep = id === 'sheep', pig = id === 'pig', dog = id === 'dog', golden = id === 'goldenCow';
  const color = sheep ? P.cream : pig ? P.rose : dog ? P.woodLight : golden ? P.gold : P.white;
  const body = joint(rig, 'body', 0, .67);
  block(body, [.65, .53, 1.05], [0, 0, 0], color);
  if (sheep) {
    for (const side of [-1, 1]) for (const z of [-.35, 0, .35]) block(body, [.17, .35, .28], [side * .35, .04, z], P.white);
    for (const z of [-.35, 0, .35]) block(body, [.5, .17, .27], [0, .29, z], P.white);
  }
  if (!sheep && !pig && !dog && !golden) {
    for (const side of [-1, 1]) {
      block(body, [.025, .26, .31], [side * .335, .07, -.22], P.ink);
      block(body, [.025, .18, .2], [side * .335, -.12, .23], P.ink);
    }
  }
  const head = joint(body, 'head', 0, .17, .52);
  block(head, [.48, .43, .44], [0, .08, .1], sheep ? P.hair : color);
  face(head, .16, .34, .46);
  block(head, [.32, .17, .16], [0, -.04, .38], pig ? P.coral : sheep ? P.wood : P.rose);
  if (pig) for (const x of [-.08, .08]) block(head, [.035, .045, .02], [x, -.03, .47], P.hair);
  for (const side of [-1, 1]) {
    block(head, [dog ? .14 : .21, dog ? .35 : .12, .15], [side * .3, dog ? .02 : .25, .05], dog ? P.wood : color).rotation.z = side * .25;
    if (!sheep && !pig && !dog) block(head, [.1, .2, .1], [side * .18, .37, -.02], P.cream);
  }
  for (let i = 0; i < 4; i++) {
    const leg = joint(body, 'leg' + i, i % 2 ? .23 : -.23, -.18, i < 2 ? .36 : -.36);
    block(leg, [.17, .4, .19], [0, -.2, 0], sheep ? P.hair : color);
    block(leg, [.19, .09, .23], [0, -.43, .025], P.wood);
  }
  const tail = joint(body, 'tail', 0, .12, -.56);
  block(tail, [.11, pig ? .15 : .38, .12], [0, pig ? .03 : .12, -.1], color).rotation.x = .5;
  return finish(rig, id, sheep ? 1.05 : pig ? .8 : dog ? .9 : 1.45);
}
