import { Group } from 'three';
import type { HelmetId } from '../types/contracts';
import { palette as P } from './palette';
import { block, cylinder } from './parts';

export function weapon(kind: 'sword' | 'shield' | 'bow' | 'arrow' | 'trident' | 'caduceus' | 'wand', color: string = P.gold): Group {
  const g = new Group(); g.name = kind;
  if (kind === 'shield') {
    block(g, [.65, .78, .12], [0, .1, 0], color);
    block(g, [.5, .61, .06], [0, .1, .08], P.bronze);
    block(g, [.25, .25, .08], [0, .1, .13], color).rotation.z = Math.PI / 4;
  } else if (kind === 'bow') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8 - .5) * Math.PI, b = ((i + 1) / 8 - .5) * Math.PI;
      const x1 = Math.cos(a) * .3, y1 = Math.sin(a) * .55;
      const x2 = Math.cos(b) * .3, y2 = Math.sin(b) * .55;
      block(g, [.075, Math.hypot(x2 - x1, y2 - y1) + .02, .09], [(x1 + x2) / 2, (y1 + y2) / 2, 0], P.woodLight).rotation.z = -Math.atan2(x2 - x1, y2 - y1);
    }
    block(g, [.015, 1.1, .015], [0, 0, 0], P.cream);
  } else if (kind === 'arrow') {
    block(g, [.035, .9, .035], [0, .3, 0], P.wood);
    block(g, [.11, .11, .045], [0, .8, 0], P.stone).rotation.z = Math.PI / 4;
    block(g, [.14, .16, .025], [0, -.1, 0], P.cream);
  } else if (kind === 'sword') {
    block(g, [.1, .24, .1], [0, 0, 0], P.wood);
    block(g, [.36, .07, .14], [0, .14, 0], P.gold);
    block(g, [.13, .65, .06], [0, .5, 0], P.stone);
    block(g, [.1, .1, .06], [0, .86, 0], P.stone).rotation.z = Math.PI / 4;
  } else {
    block(g, [.07, 1.35, .07], [0, .35, 0], P.woodLight);
    if (kind === 'trident') {
      block(g, [.5, .08, .09], [0, .92, 0], color);
      for (const x of [-.22, 0, .22]) block(g, [.08, x === 0 ? .46 : .32, .08], [x, 1.08, 0], color);
    } else if (kind === 'caduceus') {
      for (let i = 0; i < 5; i++) for (const side of [-1, 1]) {
        const piece = block(g, [.22, .05, .08], [side * .07, .3 + i * .14, 0], P.gold);
        piece.rotation.z = side * (i % 2 ? .6 : -.6);
      }
      for (const side of [-1, 1]) block(g, [.28, .1, .12], [side * .2, 1, 0], P.white).rotation.z = side * .3;
    } else {
      block(g, [.23, .23, .12], [0, 1.04, 0], P.gold, true).rotation.z = Math.PI / 4;
      block(g, [.11, .11, .15], [0, 1.04, .02], P.cream, true);
    }
  }
  return g;
}

export function helmet(id: HelmetId): Group {
  const g = new Group(); g.name = 'helmet-' + id;
  if (id === 'none') return g;
  if (id === 'laurel') {
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      block(g, [.19, .08, .12], [Math.cos(a) * .34, .02, Math.sin(a) * .31], P.leaf).rotation.y = -a;
    }
  } else {
    block(g, [.76, .16, .65], [0, .04, 0], id === 'owl' ? P.stone : P.bronze);
    for (const side of [-1, 1]) block(g, [.08, .26, .35], [side * .34, -.12, -.05], P.bronze);
    if (id === 'crested') {
      block(g, [.14, .25, .6], [0, .23, 0], P.coral);
      block(g, [.15, .14, .23], [0, .13, -.34], P.coral);
    }
    if (id === 'owl') {
      for (const side of [-1, 1]) {
        block(g, [.13, .22, .12], [side * .23, .2, 0], P.stone).rotation.z = side * -.2;
        cylinder(g, .09, .04, [side * .17, .06, .36], P.gold).rotation.x = Math.PI / 2;
      }
    }
  }
  return g;
}
