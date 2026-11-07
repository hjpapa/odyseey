import { Box3, Group, Vector3 } from 'three';
import type { PropId } from '../types/contracts';
import { palette as P } from './palette';
import { block, cylinder, finish, joint } from './parts';
import { weapon } from './equipment';

export function prop(id: PropId): Group {
  const g = new Group();
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string = P.wood) => block(g, [w, h, d], [x, y, z], color);
  const flower = (x: number, z: number, color: string, height = .5) => {
    box(.05, height, .05, x, height / 2, z, P.leaf);
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; box(.17, .07, .17, x + Math.cos(a) * .13, height, z + Math.sin(a) * .13, color); }
    box(.1, .1, .1, x, height + .02, z, P.gold);
  };
  const pillars = (width: number, depth: number, height: number) => {
    for (const x of [-width / 2, width / 2]) for (const z of [-depth / 2, depth / 2]) {
      box(.65, .25, .65, x, .3, z, P.marble);
      cylinder(g, .22, height, [x, height / 2 + .4, z], P.marble);
      box(.65, .2, .65, x, height + .4, z, P.marble);
    }
  };
  switch (id) {
    case 'sword': case 'shield': case 'bow': case 'arrow': case 'trident': case 'caduceus': case 'wand': {
      // Equipment retains its hand grip at (0,0,0), unlike floor-standing props.
      const item = weapon(id), size = new Box3().setFromObject(item).getSize(new Vector3());
      item.userData = { height: size.y, radius: Math.hypot(size.x, size.z) / 2 };
      return item;
    }
    case 'raft': case 'ship': case 'phaeacianShip': case 'rowboat': {
      const raft = id === 'raft', small = id === 'rowboat', w = small ? 1.6 : raft ? 2.5 : 3.4, length = small ? 3 : raft ? 3.5 : 6.4;
      if (raft) for (let i = 0; i < 6; i++) box(.36, .35, length, (i - 2.5) * .4, .2, 0, i % 2 ? P.wood : P.woodLight);
      else {
        box(w * .7, .42, length * .88, 0, .26, 0);
        box(w, .22, length, 0, .52, 0, P.woodLight);
        for (const side of [-1, 1]) box(.18, .5, length * .9, side * w / 2, .8, 0, id === 'phaeacianShip' ? P.blue : P.wood);
        for (const z of [-length / 2, length / 2]) box(w * .72, .58, .2, 0, .8, z);
        for (const z of [-.8, .3]) box(w, .12, .34, 0, .75, z, P.woodLight);
      }
      if (!small) {
        box(.15, 3.8, .15, 0, 2.25, 0);
        box(w * .95, .1, .1, 0, 3.5, 0);
        box(w * .9, 1.8, .06, 0, 2.6, .05, id === 'phaeacianShip' ? P.blue : P.cream);
        box(.18, 1.8, .02, 0, 2.6, .1, P.gold);
      } else {
        for (const side of [-1, 1]) {
          box(.1, .1, 2.4, side * 1, .85, 0, P.woodLight).rotation.y = side * .45;
          box(.28, .08, .5, side * 1.5, .85, .9, P.woodLight);
        }
      }
      if (id === 'phaeacianShip') for (const side of [-1, 1]) {
        box(.15, .18, 1, side * .6, 1.2, length / 2, P.gold).rotation.x = -.4;
      }
      break;
    }
    case 'palmTree': case 'oliveTree': case 'pineTree': {
      const palm = id === 'palmTree', pine = id === 'pineTree';
      box(.45, 3.5, .45, 0, 1.75, 0, P.wood);
      if (palm) {
        for (let i = 0; i < 6; i++) {
          const leaf = joint(g, 'frond' + i, 0, 3.4);
          leaf.rotation.y = i * Math.PI / 3;
          block(leaf, [.65, .18, 2.1], [0, -.15, 1], P.leaf).rotation.x = .22;
          block(leaf, [.4, .16, .8], [0, -.55, 2.1], P.leafLight).rotation.x = .5;
        }
      } else if (pine) {
        for (let i = 0; i < 4; i++) box(2.6 - i * .55, .8, 2.6 - i * .55, 0, 1.5 + i * .65, 0, i % 2 ? P.leaf : P.leafLight);
      } else {
        for (const [x,y,z] of [[0,3.5,0],[-.8,3,.1],[.8,3,-.2],[0,3,.7]]) box(1.7, 1.1, 1.5, x,y,z,P.leaf);
        for (let i = 0; i < 6; i++) box(.15,.2,.15,(i%3-1)*.65,2.65+(i%2)*.4,.8,P.ink);
      }
      break;
    }
    case 'bush':
      for (const x of [-.45,0,.45]) box(.75,.65,.8,x,.35+(x===0?.15:0),0,P.leaf);
      break;
    case 'flowerPatch': for (const [x,z] of [[0,0],[.4,.2],[-.4,.1],[.2,-.35],[-.25,-.4]]) flower(x,z,P.rose,.3+(x+.4)*.3); break;
    case 'grassTuft':
      for (let i=0;i<5;i++) box(.1,.3+(i%2)*.15,.08,(i-2)*.09,.2,0,i%2?P.leaf:P.leafLight).rotation.z=(i-2)*-.15;
      break;
    case 'lotus': box(.65,.05,.6,0,.03,0,P.leaf); flower(0,0,P.rose,.23); break;
    case 'molyFlower': box(.15,.1,.15,0,.05,0,P.ink); flower(0,0,P.white,.55); break;
    case 'rock': case 'boulder': case 'cliff': {
      const s=id==='cliff'?4:id==='boulder'?2:1;
      box(s,.65*s,.85*s,0,.33*s,0,P.stone);
      box(.7*s,.5*s,.7*s,.1*s,.78*s,0,P.marble).rotation.y=.15;
      if(id==='cliff') box(s*.9,s*.8,s*.6,-.1,s*1.2,0,P.stone);
      break;
    }
    case 'caveEntrance':
      for(const side of [-1,1]) { box(1.3,3.8,1.8,side*2,1.9,0,P.stone); box(1.5,1.2,2,side*1.4,3.7,0,P.stone); }
      box(2,1,2,0,4.25,0,P.stone); break;
    case 'whirlpool':
      for(let ring=0;ring<4;ring++) for(let i=0;i<10;i++) {
        const a=i*Math.PI/5+ring*.2,r=.6+ring*.5;
        box(.65,.06,.23,Math.cos(a)*r,.08+ring*.04,Math.sin(a)*r,ring%2?P.sea:P.blue).rotation.y=-a+Math.PI/2;
      } break;
    case 'column': case 'brokenColumn':
      box(.95,.2,.95,0,.1,0,P.marble);
      cylinder(g,.32,id==='column'?2.6:1.3,[0,id==='column'?1.5:.85,0],P.marble);
      if(id==='column') box(.9,.2,.9,0,2.9,0,P.marble);
      else box(.4,.25,.45,.14,1.58,0,P.stone).rotation.z=.15;
      break;
    case 'temple': case 'palace': {
      const palace=id==='palace',w=palace?8:5,d=palace?6:4,h=palace?4.4:3;
      box(w+1,.35,d+1,0,.18,0,P.marble); pillars(w-.8,d-.8,h);
      box(w,.35,d,0,h+.65,0,P.marble);
      for(let i=0;i<4;i++) box(w-i*.7,.28,d+.2,0,h+.95+i*.25,0,palace?P.blue:P.coral);
      if(palace) {
        box(w-.8,3,.25,0,1.9,-d/2,P.marble);
        for(const x of [-2,2]) box(1,1.8,.12,x,2,-d/2+.2,P.gold);
      }
      break;
    }
    case 'hut': case 'house': {
      const hut=id==='hut',w=hut?2.5:3.6;
      box(w,.18,2.5,0,.09,0,P.stone);
      box(w,1.9,.18,0,1,-1.15,hut?P.wood:P.marble);
      for(const side of [-1,1]) box(.18,1.9,2.5,side*w/2,1,0,hut?P.woodLight:P.marble);
      for(const x of [-w*.36,w*.36]) box(w*.28,1.9,.18,x,1,1.2,hut?P.wood:P.marble);
      box(.9,.55,.2,0,1.72,1.2,hut?P.wood:P.marble);
      for(let i=0;i<4;i++) box(w+.5-i*.6,.27,2.9,0,2.1+i*.25,0,hut?P.sand:P.coral);
      break;
    }
    case 'dock': case 'bridge':
      for(let i=0;i<9;i++) box(2,.14,.4,0,.45,(i-4)*.43,P.woodLight);
      for(const side of [-1,1]) for(const z of [-1.6,0,1.6]) {
        box(.16,id==='bridge'?1.4:.9,.16,side*.95,.5,z);
      }
      if(id==='bridge') for(const side of [-1,1]) box(.12,.12,3.7,side*.95,1.1,0);
      break;
    case 'fence':
      for(const x of [-1,0,1]) box(.14,1.2,.14,x,.6,0);
      for(const y of [.4,.9]) box(2.2,.12,.1,0,y,0,P.woodLight);
      break;
    case 'stairs':
      for(let i=0;i<5;i++) box(2,(i+1)*.22,.4,0,(i+1)*.11,i*.4,P.marble);
      break;
    case 'chest': {
      box(1.1,.65,.75,0,.33,0);
      const lid=joint(g,'lid',0,.65,-.38);
      block(lid,[1.12,.22,.79],[0,.1,.38],P.woodLight);
      for(const x of [-.4,.4]) { box(.1,.7,.78,x,.35,0,P.gold); block(lid,[.1,.25,.81],[x,.1,.38],P.gold); }
      box(.19,.23,.08,0,.55,.43,P.gold); break;
    }
    case 'coin':
      cylinder(g,.3,.09,[0,.32,0],P.gold).rotation.x=Math.PI/2;
      box(.12,.32,.04,0,.32,.07,P.cream).rotation.z=-.4;
      break;
    case 'owlShrine':
      box(1.3,.2,1.2,0,.1,0,P.marble); box(.8,1,.7,0,.7,0,P.marble);
      box(.68,.62,.55,0,1.51,0,P.gold);
      for(const side of [-1,1]) {
        box(.23,.23,.06,side*.17,1.57,.31,P.white);
        box(.1,.12,.05,side*.17,1.57,.35,P.ink);
        box(.14,.2,.15,side*.24,1.89,0,P.gold);
      } box(.1,.12,.1,0,1.43,.34,P.bronze); break;
    case 'wisdomGate':
      for(const x of [-1.1,1.1]) { box(.55,2.7,.65,x,1.35,0,P.marble); box(.75,.2,.8,x,2.7,0,P.gold); }
      box(2.9,.35,.85,0,2.95,0,P.marble);
      for(const x of [-.6,0,.6]) box(.3,.3,.1,x,2.95,.5,P.sea).rotation.z=Math.PI/4;
      break;
    case 'checkpointFlag':
      box(.7,.16,.6,0,.08,0,P.stone); box(.1,2.3,.1,0,1.25,0,P.woodLight);
      box(.95,.6,.06,.5,2.05,0,P.sea); box(.18,.18,.03,.5,2.05,.05,P.gold).rotation.z=Math.PI/4; break;
    case 'signpost':
      box(.13,1.6,.13,0,.8,0); box(1.1,.45,.12,0,1.3,.02,P.woodLight);
      box(.4,.06,.03,0,1.3,.1,P.ink); box(.18,.06,.03,.2,1.35,.1,P.ink).rotation.z=-.6; break;
    case 'log':
      cylinder(g,.22,1.4,[0,.24,0],P.wood).rotation.z=Math.PI/2;
      for(const x of [-.71,.71]) cylinder(g,.18,.015,[x,.24,0],P.woodLight).rotation.z=Math.PI/2;
      break;
    case 'campfire': case 'torch':
      if(id==='campfire') {
        for(const side of [-1,1]) box(.18,.18,1,side*.15,.12,0,P.wood).rotation.y=side*.65;
        for(let i=0;i<8;i++){const a=i*Math.PI/4;box(.2,.17,.2,Math.cos(a)*.6,.1,Math.sin(a)*.6,P.stone);}
      } else box(.15,1.2,.15,0,.6,0);
      for(let i=0;i<3;i++) {
        const y=id==='torch'?1.2:.2;
        block(g,[.35-i*.1,.35,.3-i*.08],[0,y+.16+i*.22,0],i===0?P.coral:P.gold,true);
      } break;
    case 'amphora':
      cylinder(g,.32,.65,[0,.4,0],P.coral); cylinder(g,.15,.3,[0,.85,0],P.coral);
      cylinder(g,.22,.1,[0,1.03,0],P.sand);
      for(const side of [-1,1]) { box(.1,.4,.12,side*.4,.7,0,P.coral); box(.25,.1,.12,side*.3,.87,0,P.coral); } break;
    case 'barrel':
      cylinder(g,.42,.95,[0,.48,0],P.woodLight);
      for(const y of [.17,.75]) cylinder(g,.44,.09,[0,y,0],P.wood); break;
    case 'crate':
      box(.9,.9,.9,0,.45,0,P.woodLight);
      for(const z of [-.46,.46]) {
        for(const x of [-.37,.37]) box(.12,.9,.05,x,.45,z);
        box(.1,1.05,.05,0,.45,z).rotation.z=.7;
      } break;
    case 'net':
      for(let i=0;i<7;i++){box(.025,.025,1.5,(i-3)*.25,.03,0,P.sand);box(1.5,.025,.025,0,.04,(i-3)*.25,P.sand);} break;
    case 'cage':
      for(const y of [.1,1.8]) box(1.6,.15,1.6,0,y,0,P.wood);
      for(let i=0;i<5;i++) for(const side of [-1,1]) {
        box(.06,1.7,.06,(i-2)*.36,.95,side*.74,P.woodLight);
        box(.06,1.7,.06,side*.74,.95,(i-2)*.36,P.woodLight);
      } break;
    case 'windBag':
      box(.7,.75,.55,0,.4,0,P.blue); box(.4,.22,.4,0,.86,0,P.blue); box(.48,.08,.46,0,.84,0,P.gold);
      for(let i=0;i<3;i++) box(.36-i*.05,.04,.025,0,.3+i*.15,.29,P.cream); break;
    case 'loom':
      for(const x of [-.7,.7]) box(.15,1.8,.18,x,.9,0,P.wood);
      for(const y of [.3,1.65]) box(1.5,.14,.18,0,y,0,P.woodLight);
      for(let i=0;i<9;i++) box(.018,1.35,.02,(i-4)*.13,.97,0,P.cream);
      for(let i=0;i<7;i++) box(1.15,.075,.05,0,.38+i*.09,.03,i%2?P.purple:P.gold); break;
    case 'oliveBed':
      box(1.6,.4,2.4,0,.5,0); box(1.5,.18,2.2,0,.78,0,P.cream); box(1.5,.08,1.4,0,.91,.25,P.purple);
      box(1.1,.17,.45,0,.93,-.7,P.white); box(.32,2.5,.32,-.65,1.25,-.95);
      for(const x of [-.9,-.4]) box(.8,.5,.8,x,2.4,-.95,P.leaf);
      for(const x of [-.6,.6]) for(const z of [-1,1]) box(.18,.5,.18,x,.25,z); break;
    case 'axeRow':
      for(let i=0;i<12;i++){
        const z=(i-5.5)*.65;
        box(.1,1.3,.1,0,.65,z,P.woodLight);
        for(const x of [-.24,.24]) box(.16,.48,.1,x,1.36,z,P.stone);
        for(const y of [1.1,1.62]) box(.6,.1,.1,0,y,z,P.stone);
      } break;
    case 'ball':
      box(.48,.48,.48,0,.3,0,P.coral); box(.5,.1,.5,0,.3,0,P.cream); break;
    case 'sundial':
      cylinder(g,.6,.18,[0,.12,0],P.marble);
      box(.06,.45,.23,0,.4,0,P.bronze).rotation.x=.45;
      for(let i=0;i<12;i++){const a=i*Math.PI/6;box(.05,.03,.09,Math.sin(a)*.48,.23,Math.cos(a)*.48,P.ink).rotation.y=a;} break;
    case 'clockTower':
      box(1.2,3.5,1.2,0,1.75,0,P.marble); box(1.5,.25,1.5,0,3.6,0,P.blue);
      box(1,1,.06,0,2.7,.65,P.white);
      for(let i=0;i<12;i++){const a=i*Math.PI/6;box(.05,.08,.03,Math.sin(a)*.4,2.7+Math.cos(a)*.4,.7,P.ink).rotation.z=-a;}
      box(.045,.35,.035,0,2.86,.73,P.ink); box(.25,.055,.035,.1,2.7,.74,P.coral); break;
  }
  return finish(g,id);
}
