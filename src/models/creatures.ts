import { Group, type Object3D } from 'three';
import type { CreatureId } from '../types/contracts';
import { box, disc, finish, part } from './geometry';
import { P } from './palette';

export const CREATURE_NAMES: Record<CreatureId, string> = {
  athenaOwl:'아테나의 부엉이', sheep:'양', cow:'소', goldenCow:'태양의 소',
  pig:'돼지', dog:'아르고스', seagull:'갈매기', dolphin:'돌고래', scylla:'스킬라',
};

function eyes(parent: Object3D, spacing: number, y: number, z: number, size = .07) {
  for (const s of [-1, 1]) {
    box(parent, P.ink, size, size * 1.15, .03, s * spacing, y, z);
    box(parent, P.white, size * .3, size * .3, .015, s * spacing - size * .14, y + size * .2, z + .02);
  }
}

function bird(owl: boolean): Group {
  const g = new Group();
  const body = part(g, 'body', 0, .34);
  box(body, owl ? '#a68155' : P.white, .55, .53, .40);
  box(body, owl ? P.linen : P.gray, .35, .34, .05, 0, -.025, .22);
  const head = part(body, 'head', 0, .26, .02);
  box(head, owl ? '#8d6a4a' : P.white, owl ? .62 : .37, .36, .40, 0, .09);
  if (owl) {
    for (const s of [-1, 1]) {
      disc(head, P.linen, .15, .04, s * .145, .09, .215).rotation.x = Math.PI / 2;
      box(head, '#8d6a4a', .14, .19, .16, s * .23, .30, -.06).rotation.z = -s * .24;
    }
    eyes(head, .145, .09, .245, .09);
    box(head, P.gold, .09, .12, .09, 0, -.035, .24).rotation.z = Math.PI / 4;
  } else {
    eyes(head, .12, .12, .22, .065);
    box(head, P.gold, .13, .085, .22, 0, 0, .28);
  }
  for (const s of [-1, 1]) {
    const w = part(body, s > 0 ? 'wingL' : 'wingR', s * .28, .12);
    box(w, owl ? '#71573f' : '#c2cfce', .19, .40, .30, s * .045, -.14).rotation.z = s * .12;
    for (let i = 0; i < 2; i++) box(w, owl ? '#c49d67' : P.white, .06, .20, .035, s * (.02 + i * .07), -.16, .17);
    box(g, P.gold, .14, .055, .22, s * .14, .025, .06);
  }
  return finish(g, owl ? .75 : .65, .3);
}

function quadruped(id: 'sheep'|'cow'|'goldenCow'|'pig'|'dog'): Group {
  const g = new Group();
  const cow = id === 'cow' || id === 'goldenCow';
  const sheep = id === 'sheep';
  const dog = id === 'dog';
  const color = id === 'goldenCow' ? '#e8bf63' : id === 'pig' ? '#dca8a0' : dog ? '#ae865d' : P.linen;
  const body = part(g, 'body', 0, .63);
  box(body, color, .72, .60, 1.05);
  if (sheep) {
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      box(body, i % 2 ? P.linen : P.ivory, .30, .40, .37, s * .28, .08, -.33 + i * .32);
    }
  }
  if (cow) {
    for (const s of [-1, 1]) box(body, id === 'goldenCow' ? P.gold : '#725b48', .07, .31, .37, s * .37, .04, -.13);
  }
  const head = part(body, 'head', 0, .20, .52);
  box(head, sheep ? '#746656' : color, .47, .46, .46, 0, .04, .09);
  box(head, dog ? '#dac49f' : '#d6aaa0', .37, .20, .22, 0, -.10, .34);
  eyes(head, .13, .12, .34);
  if (dog) box(head, P.ink, .12, .075, .07, 0, -.04, .47);
  else for (const s of [-1, 1]) box(head, P.leather, .04, .045, .025, s * .09, -.09, .46);
  for (const s of [-1, 1]) {
    box(head, dog ? P.leather : color, .17, dog ? .36 : .14, .20, s * .28, dog ? .02 : .23, .01).rotation.z = s * .25;
    if (cow) box(head, P.ivory, .09, .25, .10, s * .20, .37, 0).rotation.z = -s * .3;
  }
  for (let i = 0; i < 4; i++) {
    const leg = part(g, `leg${i}`, (i % 2 ? 1 : -1) * .25, .45, (i < 2 ? 1 : -1) * .36);
    box(leg, sheep ? '#746656' : color, .16, .37, .18, 0, -.18);
    box(leg, P.sole, .18, .09, .22, 0, -.405, .02);
  }
  const tail = part(body, 'tail', 0, .05, -.56);
  box(tail, color, .12, dog ? .38 : .23, .13, 0, dog ? .16 : -.07, -.035).rotation.x = -.4;
  if (id === 'goldenCow') {
    const sun = part(head, 'sunDisc', 0, .42, -.01);
    disc(sun, P.gold, .17, .045).rotation.x = Math.PI / 2;
    box(body, P.gold, .78, .08, .12, 0, .22, .30);
  }
  return finish(g, cow ? 1.55 : sheep ? 1.05 : dog ? .90 : .85, cow ? .55 : .42);
}

function dolphin(): Group {
  const g = new Group();
  const body = part(g, 'body', 0, .38);
  box(body, '#709ea7', .55, .46, 1.15);
  box(body, '#c5dcd6', .45, .15, .95, 0, -.17, .06);
  const head = part(body, 'head', 0, .015, .56);
  box(head, '#709ea7', .43, .34, .42, 0, 0, .07);
  box(head, '#709ea7', .20, .13, .36, 0, -.07, .35);
  eyes(head, .13, .07, .29);
  box(body, '#4e7d89', .11, .30, .30, 0, .33, -.13).rotation.x = -.3;
  for (const s of [-1, 1]) box(body, '#4e7d89', .33, .07, .28, s * .34, -.10, .08).rotation.z = -s * .25;
  const tail = part(body, 'tail', 0, 0, -.66);
  box(tail, '#709ea7', .28, .23, .38, 0, 0, -.08);
  box(tail, '#4e7d89', .66, .09, .25, 0, .04, -.31);
  return finish(g, .8, .48);
}

function scylla(): Group {
  const g = new Group();
  const body = part(g, 'body', 0, .55);
  box(body, '#488b84', 2.8, 1.1, 1.8);
  box(body, '#b5ceb1', 2.2, .58, .12, 0, -.05, .93);
  for (let i = 0; i < 6; i++) {
    const x = (i % 3 - 1) * 1.05;
    const front = i < 3;
    const length = front ? 1.5 + (i % 2) * .3 : 2.8 + (i % 2) * .35;
    const neck = part(body, `neck${i}`, x, .45, front ? .55 : -.45);
    box(neck, i % 2 ? '#488b84' : '#5e9d92', .37, length, .40, 0, length / 2);
    box(neck, '#bdd7ad', .22, length - .15, .045, 0, length / 2, .22);
    const head = part(neck, `head${i}`, 0, length, .08);
    box(head, '#65a49a', .72, .60, .68, 0, .14);
    box(head, '#b5ceb1', .55, .22, .27, 0, -.02, .40);
    eyes(head, .18, .24, .36, .095);
    for (const s of [-1, 1]) box(head, P.gold, .10, .22, .12, s * .25, .50, -.12).rotation.z = -s * .22;
    box(head, '#3b6d69', .23, .025, .03, 0, -.055, .55);
  }
  const tail = part(body, 'tail', 0, -.1, -1);
  box(tail, '#488b84', .6, .42, 1.2, 0, .05, -.45);
  box(tail, P.gold, .75, .09, .40, 0, .20, -.95);
  return finish(g, 6.6, 1.45);
}

export function creature(id: CreatureId): Group {
  const g = id === 'athenaOwl' || id === 'seagull' ? bird(id === 'athenaOwl')
    : id === 'scylla' ? scylla() : id === 'dolphin' ? dolphin() : quadruped(id);
  g.name = id;
  return g;
}
