/** Greek myth costumes on the existing six-joint gameplay rig. Front is +Z. */
import { Group, type Object3D } from 'three';
import { DEFAULT_AVATAR, type HelmetId, type HumanoidId, type ModelOptions } from '../types/contracts';
import { box, disc, drape, finish, part } from './geometry';
import { P } from './palette';
import { cape, caduceus, helmet, laurel, shield, sword, trident, wand, wing } from './equipment';

interface Look {
  name: string; role: string; cloth: string; trim: string; hair: string;
  skin?: string; robe?: boolean; longHair?: boolean; beard?: boolean;
  armor?: boolean; hat?: HelmetId; cloak?: string; height?: number;
}

export const CHARACTER_LOOKS: Record<HumanoidId, Look> = {
  odysseus: { name:'오디세우스', role:'이타카로 돌아가는 모험가 · 청동 투구와 붉은 망토', cloth:P.blue, trim:P.gold, hair:P.hair, beard:true, armor:true },
  crewman: { name:'동료 선원', role:'바다를 건너는 동료 · 짧은 튜닉과 어깨띠', cloth:P.red, trim:P.linen, hair:P.hair },
  telemachus: { name:'텔레마코스', role:'이타카의 왕자 · 푸른 어깨 망토와 가죽 흉대', cloth:P.linen, trim:P.blue, hair:P.hair, cloak:P.blue, height:1.92 },
  athena: { name:'아테나', role:'지혜의 여신 · 부엉이 투구와 청동 방패', cloth:P.linen, trim:P.gold, hair:P.hair, longHair:true, robe:true, armor:true, hat:'owl', cloak:P.blue },
  hermes: { name:'헤르메스', role:'신들의 전령 · 날개 모자와 두 뱀 지팡이', cloth:P.linen, trim:P.sea, hair:'#79523b', cloak:P.red },
  calypso: { name:'칼립소', role:'섬의 요정 · 바다빛 주름옷과 꽃관', cloth:P.sea, trim:P.gold, hair:'#925c36', longHair:true, robe:true },
  ino: { name:'이노', role:'바다의 요정 · 하얀 스카프와 물결빛 옷', cloth:'#a5d6d1', trim:P.white, hair:'#536b73', longHair:true, robe:true },
  aeolus: { name:'아이올로스', role:'바람의 왕 · 바람주머니와 소용돌이 장식', cloth:'#9ebfca', trim:P.gold, hair:P.gray, beard:true, robe:true, cloak:P.blue },
  circe: { name:'키르케', role:'마법의 여인 · 자줏빛 주름옷과 마법봉', cloth:P.plum, trim:P.gold, hair:'#3b334b', longHair:true, robe:true },
  tiresias: { name:'테이레시아스', role:'지혜로운 예언자 · 긴 겉옷과 나무 지팡이', cloth:'#84859d', trim:P.linen, hair:P.gray, beard:true, robe:true, cloak:'#5c607c' },
  nausicaa: { name:'나우시카', role:'파이아케스의 공주 · 산호빛 옷과 머리띠', cloth:'#d68976', trim:P.linen, hair:'#654435', longHair:true, robe:true, height:1.94 },
  alcinous: { name:'알키노오스', role:'파이아케스의 왕 · 황금 잎관과 자주색 망토', cloth:P.linen, trim:P.gold, hair:'#675346', beard:true, robe:true, cloak:P.plum },
  penelope: { name:'페넬로페', role:'이타카의 왕비 · 직조 무늬 숄과 실꾸리', cloth:'#914f67', trim:P.gold, hair:P.hair, longHair:true, robe:true },
  eumaeus: { name:'에우마이오스', role:'이타카의 돼지치기 · 양털 조끼와 목동 지팡이', cloth:P.olive, trim:P.linen, hair:'#91806b', beard:true },
  poseidon: { name:'포세이돈', role:'바다의 신 · 삼지창과 파도 왕관', cloth:'#317879', trim:P.gold, hair:'#c3ded5', beard:true, longHair:true, robe:true, height:8 },
  helios: { name:'헬리오스', role:'태양의 신 · 햇살 왕관과 황금빛 옷', cloth:'#e6af4e', trim:P.ivory, hair:'#ac6834', robe:true, cloak:P.red, height:7.5 },
  polyphemus: { name:'폴리페모스', role:'외눈 거인 · 커다란 눈과 양치기 차림', cloth:'#977850', trim:P.linen, hair:P.hair, beard:true, height:6 },
  lotusEater: { name:'연꽃족', role:'연꽃 섬 사람 · 꽃 장식과 풀빛 튜닉', cloth:'#869964', trim:'#d89eac', hair:'#685345' },
  lotusKing: { name:'연꽃 왕', role:'연꽃 섬의 왕 · 연꽃 왕관과 잎사귀 망토', cloth:'#72845b', trim:'#e2a6b8', hair:'#6a4b68', robe:true, cloak:P.olive, height:2.5 },
  laestrygonian: { name:'라이스트리고네스', role:'항구의 거인 · 거친 어깨옷과 넓은 허리띠', cloth:'#ab7352', trim:P.linen, hair:'#5b463c', beard:true, height:4.3 },
  laestrygonianKing: { name:'거인 왕', role:'거인의 왕 · 돌빛 왕관과 붉은 어깨옷', cloth:'#8f5448', trim:P.gold, hair:'#51443b', beard:true, cloak:P.red, height:6.2 },
  siren: { name:'세이렌', role:'노래하는 새의 요정 · 깃털 날개와 작은 리라', cloth:'#8098ba', trim:P.ivory, hair:'#625074', longHair:true },
  sirenQueen: { name:'세이렌 여왕', role:'노래의 여왕 · 큰 날개와 황금 리라', cloth:'#74658f', trim:P.gold, hair:'#42435f', longHair:true, height:2.5 },
  greekSoldier: { name:'그리스 병사', role:'청동 갑옷과 둥근 방패를 든 병사', cloth:P.red, trim:P.gold, hair:P.hair, armor:true, hat:'bronze' },
  soldierCaptain: { name:'병사 대장', role:'붉은 깃 투구와 청동 갑옷', cloth:P.red, trim:P.gold, hair:P.hair, beard:true, armor:true, hat:'crested', cloak:P.red, height:2.3 },
  suitor: { name:'구혼자', role:'궁전의 손님 · 비스듬한 겉옷과 장식띠', cloth:'#9c7397', trim:P.gold, hair:'#6c4c38', robe:true },
  antinous: { name:'안티노오스', role:'구혼자의 우두머리 · 황금 머리띠와 자주색 겉옷', cloth:'#6e476b', trim:P.gold, hair:'#3a313b', armor:true, cloak:P.plum, height:2.3 },
};

const variants = [P.red, P.blue, P.olive, P.plum];
const skins = [P.skin, '#bc875f', '#e4b88d', '#986647'];

function badge(parent: Object3D, color: string, x: number, y: number, z: number, radius = .065) {
  disc(parent, color, radius, .035, x, y, z).rotation.x = Math.PI / 2;
}

function face(head: Group, look: Look, cyclops: boolean) {
  const skin = look.skin ?? P.skin;
  box(head, skin, .60, .55, .53, 0, .27);
  box(head, look.hair, .64, .16, .56, 0, .55, -.025);
  box(head, look.hair, .60, .39, .09, 0, .34, -.265);
  for (const side of [-1, 1]) {
    box(head, skin, .09, .14, .13, side * .31, .25);
    box(head, look.hair, .11, .22, .39, side * .26, .43, -.055);
  }
  if (look.longHair) {
    box(head, look.hair, .65, .62, .19, 0, .17, -.25);
    for (const s of [-1, 1]) box(head, look.hair, .16, .55, .23, s * .29, .12, -.06);
  }
  if (cyclops) {
    badge(head, P.ivory, 0, .30, .275, .15);
    badge(head, P.ink, 0, .30, .30, .075);
    box(head, P.white, .035, .04, .018, -.025, .33, .33);
  } else {
    for (const s of [-1, 1]) {
      box(head, P.ink, .065, .085, .025, s * .135, .29, .272);
      box(head, look.hair, .10, .035, .027, s * .135, .365, .272);
    }
    box(head, skin, .075, .085, .07, 0, .21, .285);
  }
  if (look.beard) {
    box(head, look.hair, .38, .15, .12, 0, .045, .22);
    box(head, look.hair, .24, .13, .12, 0, -.04, .22);
  }
  box(head, look.beard ? P.skin : P.blush, .14, .025, .025, 0, .105, .292);
}

function flower(parent: Object3D, color: string, x: number, y: number, z: number) {
  const g = part(parent, 'flower', x, y, z);
  for (const s of [-1, 1]) box(g, color, .15, .09, .06, s * .055, 0).rotation.z = s * .55;
  badge(g, P.gold, 0, .015, .045, .045);
}

function lyre(parent: Object3D) {
  const g = part(parent, 'lyre', 0, -.05, .12);
  box(g, P.gold, .38, .15, .1, 0, 0);
  for (const s of [-1, 1]) box(g, P.wood, .065, .46, .08, s * .16, .20).rotation.z = -s * .16;
  box(g, P.gold, .43, .065, .08, 0, .42);
  for (const x of [-.09, 0, .09]) box(g, P.linen, .014, .32, .025, x, .22, .04);
}

function staff(parent: Object3D, shepherd: boolean) {
  const g = part(parent, 'staff');
  box(g, P.wood, .065, 1.5, .065, 0, .05);
  if (shepherd) {
    box(g, P.wood, .25, .075, .07, .09, .8);
    box(g, P.wood, .075, .20, .07, .19, .73);
  } else badge(g, P.gold, 0, .86, 0, .12);
}

function adorn(id: HumanoidId, root: Group, head: Group, torso: Group, top: Group, handL: Group, handR: Group) {
  switch (id) {
    case 'athena': handL.add(shield(P.blue)); staff(handR, false); break;
    case 'hermes': {
      const hat = part(top, 'petasos');
      disc(hat, P.bronze, .42, .065, 0, -.09);
      box(hat, P.bronze, .54, .16, .49, 0, -.02);
      for (const s of [-1, 1]) {
        wing(hat, s, s * .32, .13, 0, .8);
        const leg = root.getObjectByName(s > 0 ? 'legL' : 'legR')!;
        wing(leg, s, s * .15, -.52, -.04, .45);
      }
      handR.add(caduceus()); break;
    }
    case 'calypso':
      laurel(top); flower(top, P.ivory, .23, -.05, .24); break;
    case 'ino': {
      box(torso, P.white, .74, .14, .55, 0, .60);
      const scarf = part(handL, 'whiteScarf');
      box(scarf, P.white, .22, .55, .045, .08, -.08, .12).rotation.z = -.18;
      break;
    }
    case 'aeolus': {
      laurel(top, P.gold);
      const bag = part(handL, 'windBag', 0, -.15, .04);
      box(bag, P.leather, .37, .40, .31, 0, -.12);
      box(bag, P.linen, .23, .07, .27, 0, .08);
      badge(bag, P.gold, 0, -.10, .17, .10); break;
    }
    case 'circe':
      laurel(top, P.gold); handR.add(wand());
      badge(torso, '#bcb0dc', 0, .53, .31, .09); break;
    case 'tiresias': staff(handR, false); break;
    case 'nausicaa':
      box(top, P.linen, .65, .07, .57, 0, -.1);
      flower(top, P.ivory, -.23, -.075, .25); break;
    case 'alcinous': case 'antinous': laurel(top, P.gold); break;
    case 'penelope': {
      const shawl = part(torso, 'wovenShawl');
      box(shawl, P.linen, .84, .21, .53, 0, .59);
      for (const s of [-1, 1]) box(shawl, P.plum, .08, .23, .03, s * .31, .59, .28);
      box(handL, P.wood, .22, .07, .12, 0, -.12, .08);
      box(handL, P.linen, .14, .23, .11, 0, -.02, .08);
      break;
    }
    case 'eumaeus':
      for (const s of [-1, 1]) box(torso, P.linen, .21, .42, .11, s * .28, .43, .26);
      staff(handR, true); break;
    case 'poseidon': {
      const crown = part(top, 'waveCrown');
      box(crown, P.gold, .67, .075, .58, 0, -.07);
      for (const s of [-1, 0, 1]) box(crown, P.gold, .10, s ? .23 : .33, .09, s * .24, .07, .24).rotation.z = -s * .2;
      handR.add(trident()); break;
    }
    case 'helios': {
      const crown = part(top, 'sunCrown');
      for (let i = 0; i < 7; i++) {
        const a = -.5 * Math.PI + i * Math.PI / 6;
        box(crown, P.gold, .08, .27, .08, Math.sin(a) * .38, Math.cos(a) * .35, -.05).rotation.z = -a;
      }
      badge(torso, P.gold, 0, .43, .30, .18); break;
    }
    case 'polyphemus': case 'laestrygonian': case 'laestrygonianKing':
      box(torso, P.linen, .25, .55, .08, .16, .40, .29).rotation.z = -.5;
      if (id === 'laestrygonianKing') laurel(top, P.gray);
      break;
    case 'lotusEater': case 'lotusKing':
      laurel(top);
      flower(top, '#dba8be', 0, .04, .25);
      if (id === 'lotusKing') { flower(top, P.ivory, -.25, -.02, .14); flower(top, P.ivory, .25, -.02, .14); }
      break;
    case 'siren': case 'sirenQueen':
      for (const s of [-1, 1]) wing(torso, s, s * .45, .60, -.27, id === 'sirenQueen' ? 2.5 : 2);
      lyre(handL);
      if (id === 'sirenQueen') laurel(top, P.gold);
      break;
    case 'greekSoldier': case 'soldierCaptain':
      handL.add(shield(P.red)); handR.add(sword()); break;
  }
  // Keep ornaments on the head so looking/talking rotates them with the face.
  head.userData.face = id === 'polyphemus' ? 'single-eye' : 'friendly';
}

export function humanoid(id: HumanoidId, opts: ModelOptions = {}): Group {
  const v = Math.abs(Math.trunc(opts.variant ?? 0)) % 4;
  const look = { ...CHARACTER_LOOKS[id] };
  if (['crewman', 'suitor', 'greekSoldier', 'lotusEater'].includes(id)) {
    look.cloth = variants[v]; look.skin = skins[v];
  }
  const avatar = opts.avatar ?? DEFAULT_AVATAR;
  if (id === 'odysseus') { look.cloth = avatar.tunicColor; look.hat = avatar.helmet; look.cloak = avatar.capeColor ?? undefined; }
  const root = new Group(); root.name = id;
  const torso = part(root, 'torso', 0, .79);
  box(torso, look.cloth, .76, .67, .45, 0, .36);
  // The peplos has a continuous flared silhouette, distinct from the short chiton.
  const hem = part(torso, 'chiton');
  if (look.robe) {
    drape(hem, look.cloth, 1.02, .77, .60, -.27);
    box(hem, look.trim, 1.02, .055, .61, 0, -.64);
    // Three folds read as draped fabric, not trouser legs.
    for (const x of [-.28, 0, .28]) {
      const fold = box(hem, look.cloth, .055, .63, .055, x, -.29, .28);
      fold.rotation.x = -.09;
    }
  } else {
    drape(hem, look.cloth, .88, .29, .51, -.07);
    box(hem, look.trim, .89, .055, .52, 0, -.19);
  }
  for (const s of [-1, 1]) {
    const leg = part(root, s > 0 ? 'legL' : 'legR', s * .21, .77);
    box(leg, look.skin ?? P.skin, .28, .61, .30, 0, -.32);
    box(leg, P.sole, .34, .09, .47, 0, -.725, .06);
    box(leg, P.leather, .31, .06, .40, 0, -.65, .035);
    box(leg, P.leather, .31, .055, .32, 0, -.51);
    if (!look.robe && look.armor) box(leg, P.bronze, .23, .30, .09, 0, -.41, .16);
  }
  box(torso, P.leather, .79, .10, .48, 0, .09);
  badge(torso, look.trim, 0, .09, .26, .075);
  const sash = box(torso, look.trim, .16, .62, .045, .02, .39, .255);
  sash.rotation.z = -.53;
  if (look.armor) {
    box(torso, P.bronze, .62, .34, .09, 0, .45, .25);
    box(torso, look.trim, .62, .045, .10, 0, .29, .26);
  }
  badge(torso, look.trim, .28, .64, .27);
  const back = part(torso, 'back', 0, .62, -.25);
  if (look.cloak) cape(back, look.cloak);

  const hands: Group[] = [];
  for (const s of [-1, 1]) {
    const arm = part(torso, s > 0 ? 'armL' : 'armR', s * .55, .65);
    box(arm, look.skin ?? P.skin, .29, .57, .31, 0, -.28);
    box(arm, look.cloth, .34, look.robe ? .12 : .20, .36, 0, -.035);
    box(arm, look.trim, .32, .055, .33, 0, -.43);
    box(arm, look.skin ?? P.skin, .30, .18, .33, 0, -.58, .01);
    hands.push(part(arm, s > 0 ? 'handL' : 'handR', 0, -.63, .06));
  }
  const head = part(torso, 'head', 0, .73);
  face(head, look, id === 'polyphemus');
  const top = part(head, 'headTop', 0, .63);
  if (look.hat) helmet(top, look.hat);
  adorn(id, root, head, torso, top, hands[1], hands[0]);
  return finish(root, look.height ?? 2.15, .46);
}
