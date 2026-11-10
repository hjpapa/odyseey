/** Hand-held equipment: origin is the grip, not the bottom of the object. */
import { Group, type Object3D } from 'three';
import type { HelmetId } from '../types/contracts';
import { box, disc, part } from './geometry';
import { P } from './palette';

export function sword(): Group {
  const g = new Group(); g.name = 'xiphos';
  box(g, P.leather, .10, .23, .11, 0, -.02);
  box(g, P.gold, .13, .08, .14, 0, -.17);
  box(g, P.bronze, .33, .07, .12, 0, .13);
  const blade = part(g, 'blade');
  box(blade, '#d9e1da', .17, .65, .065, 0, .49);
  box(blade, P.ivory, .035, .64, .075, 0, .49);
  const tip = box(blade, '#d9e1da', .13, .13, .055, 0, .83, 0, false);
  tip.rotation.z = Math.PI / 4;
  // Match the player's existing grip: the resting sword points forward.
  g.rotation.x = Math.PI / 2;
  g.userData = { height: 1.1, radius: .18 };
  return g;
}

export function shield(color: string = P.blue): Group {
  const g = new Group(); g.name = 'aspis';
  disc(g, P.bronze, .44, .10, 0, 0, .09).rotation.x = Math.PI / 2;
  disc(g, color, .37, .115, 0, 0, .10).rotation.x = Math.PI / 2;
  disc(g, P.gold, .11, .14, 0, 0, .12).rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    const leaf = box(g, P.gold, .07, .23, .025, side * .21, -.025, .17);
    leaf.rotation.z = side * -.45;
  }
  g.userData = { height: .88, radius: .44 };
  return g;
}

export function trident(): Group {
  const g = new Group(); g.name = 'trident';
  box(g, P.bronze, .075, 1.45, .075, 0, .20);
  box(g, P.gold, .54, .09, .08, 0, .91);
  for (const side of [-1, 0, 1]) {
    box(g, P.gold, .075, side ? .34 : .48, .08, side * .24, side ? 1.06 : 1.13);
    box(g, P.ivory, .07, .09, .09, side * .24, side ? 1.25 : 1.40).rotation.z = Math.PI / 4;
  }
  g.userData = { height: 1.95, radius: .3 }; return g;
}

export function caduceus(): Group {
  const g = new Group(); g.name = 'caduceus';
  box(g, P.gold, .065, 1.05, .065, 0, .20);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const snake = box(g, P.bronze, .19, .055, .06, side * (i % 2 ? -.04 : .04), .39 + i * .12, .02);
      snake.rotation.z = side * (i % 2 ? -.65 : .65);
    }
    wing(g, side, side * .08, .85, 0, .55);
  }
  disc(g, P.gold, .1, .08, 0, .77, 0).rotation.x = Math.PI / 2;
  g.userData = { height: 1.3, radius: .33 }; return g;
}

export function wand(): Group {
  const g = new Group(); g.name = 'wand';
  box(g, P.wood, .06, .8, .06, 0, .15);
  disc(g, P.gold, .16, .07, 0, .62).rotation.x = Math.PI / 2;
  box(g, P.plum, .15, .15, .08, 0, .62, .045).rotation.z = Math.PI / 4;
  g.userData = { height: 1.05, radius: .17 }; return g;
}

export function bow(): Group {
  const g = new Group(); g.name = 'bow';
  for (let i = 0; i < 7; i++) {
    const a = -1.25 + i * 2.5 / 6;
    const segment = box(g, P.wood, .07, .22, .07, Math.cos(a) * .32 - .1, Math.sin(a) * .62, 0);
    segment.rotation.z = -a * .6;
  }
  box(g, P.linen, .012, 1.18, .012, 0, 0);
  g.userData = { height: 1.4, radius: .4 }; return g;
}

export function arrow(): Group {
  const g = new Group(); g.name = 'arrow';
  box(g, P.wood, .025, .8, .025, 0, .3);
  box(g, P.bronze, .09, .09, .035, 0, .73).rotation.z = Math.PI / 4;
  box(g, P.linen, .1, .15, .025, 0, -.08);
  g.userData = { height: .9, radius: .08 }; return g;
}

export function wing(parent: Object3D, side: number, x: number, y: number, z: number, scale = 1) {
  const g = part(parent, side > 0 ? 'wingL' : 'wingR', x, y, z);
  for (let i = 0; i < 3; i++) {
    const feather = box(g, i === 1 ? P.linen : P.ivory, .13 * scale, (.32 - i * .055) * scale, .08 * scale,
      side * i * .09 * scale, i * .045 * scale, 0);
    feather.rotation.z = side * -.5;
  }
  return g;
}

export function laurel(parent: Object3D, color: string = P.olive) {
  const g = part(parent, 'laurel');
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const leaf = box(g, color, .15, .06, .10, side * (.13 + i * .075), -.05, .31 - i * .10);
    leaf.rotation.y = side * (.2 + i * .35);
    leaf.rotation.z = side * .22;
  }
  return g;
}

/** Anchor is at top of the hair. Cheek guards leave both eyes visible. */
export function helmet(parent: Object3D, style: HelmetId, crestColor: string = P.red) {
  if (style === 'none') return;
  if (style === 'laurel') { laurel(parent); return; }
  const g = part(parent, 'helmet');
  box(g, P.bronze, .67, .17, .60, 0, -.085, -.015);
  box(g, P.bronze, .54, .13, .50, 0, .025, -.025);
  box(g, P.gold, .69, .055, .63, 0, -.15);
  for (const s of [-1, 1]) {
    box(g, P.bronze, .11, .29, .26, s * .29, -.30, .04);
    box(g, P.gold, .025, .23, .06, s * .355, -.29, .13);
  }
  if (style === 'crested') {
    box(g, P.darkGold, .13, .1, .57, 0, .095, -.035);
    box(g, crestColor, .14, .25, .56, 0, .24, -.035);
    box(g, crestColor, .14, .19, .19, 0, .15, -.37);
  }
  if (style === 'owl') {
    for (const s of [-1, 1]) {
      disc(g, P.ivory, .085, .04, s * .085, -.03, .31).rotation.x = Math.PI / 2;
      box(g, P.ink, .035, .04, .03, s * .085, -.03, .34);
    }
    box(g, P.gold, .07, .08, .04, 0, -.11, .33).rotation.z = Math.PI / 4;
  }
}

export function cape(parent: Object3D, color: string) {
  const g = part(parent, 'cape');
  box(g, color, .85, .65, .075, 0, -.23, -.10).rotation.x = .12;
  box(g, color, .98, .42, .075, 0, -.72, -.18).rotation.x = .18;
  box(g, P.gold, .96, .045, .085, 0, -.92, -.22);
  return g;
}
