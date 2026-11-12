/**
 * 바다 코스 장면 — 두 가지 모드.
 * - 러너 (2장 '폭풍 파도 러너'): 폭풍 속을 달린다. 바위는 옆으로, 큰 파도는 점프, 번개는 예고된 줄을 피하고
 *   영어 글자 방울을 순서대로 모은다. 뗏목이 부서지면 이노의 스카프로 한 번 살아난다.
 * - 항해 (10장 해협처럼 waveRunner 목표가 없는 코스): 섬 데이터의 바위·소용돌이를 줄을 바꿔 피한다.
 *   바다 위 지혜의 문 앞에서 멈춰 퀴즈를 풀고, 보스(스킬라) 무대에서 멈춰 싸운다.
 */
import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, MeshToonMaterial,
  type Object3D, Points, PointsMaterial, Scene, SphereGeometry, Vector3,
} from 'three';
import type { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { ChapterData, EnglishWord, IslandLayout, Objective, PropId } from '../types/contracts';
import type { InputFrame } from '../core/input';
import { createRng, type Rng } from '../core/rng';
import { getModel } from '../core/models';
import { block } from '../core/placeholders';
import { createEnvironment, type Environment } from '../world/environment';
import { alignLengthToZ, makeProp, splitByHeight } from '../world/props';
import { buildGate } from '../world/gates';
import { Effects, label } from '../play/effects';
import { HumanoidRig } from '../play/rig';
import { englishWords } from '../learning/data';
import { h, sleep } from '../ui/dom';
import { ChapterStage } from './chapterStage';
import type { Services } from './services';

const MAX_HP = 3;
const JUMP = 9;
const GRAV = 26;

type Kind = 'rock' | 'pool' | 'wave' | 'letter' | 'bolt';
interface Thing {
  kind: Kind;
  lane: number;
  z: number;
  obj: Group | Mesh;
  letter?: string;
  tag?: CSS2DObject;
  /** 번개: 내리치기까지 남은 시간 */
  t?: number;
  /** 번개: 뗏목이 가까이 와서 예고가 시작됨 */
  armed?: boolean;
  done?: boolean;
}

interface SeaGate {
  z: number;
  slot: string;
  obj: Group;
  open: boolean;
  asking: boolean;
}

/** 바다 위 보스 (스킬라): 머리가 예고된 줄을 내리친다 → 줄을 바꿔 피하고, 지치면 약점 퀴즈 */
interface SeaBoss {
  name: string;
  model: Group;
  heads: Object3D[];
  glow: Mesh;
  hp: number;
  max: number;
  t: number;
  phase: 'idle' | 'warn';
  lane: number;
  strikes: number;
  busy: boolean;
  active: boolean;
  lunge: number;
  head: number;
}

/** 항해 모드에서 부딪히는 소품 */
const HAZARD_PROPS: Partial<Record<PropId, Kind>> = { rock: 'rock', boulder: 'rock', whirlpool: 'pool' };

const FALLBACK_WORDS: Pick<EnglishWord, 'word' | 'meaningKo' | 'emoji'>[] = [
  { word: 'sea', meaningKo: '바다', emoji: '🌊' },
  { word: 'boat', meaningKo: '배', emoji: '⛵' },
  { word: 'fish', meaningKo: '물고기', emoji: '🐟' },
  { word: 'wind', meaningKo: '바람', emoji: '🌬️' },
  { word: 'wave', meaningKo: '파도', emoji: '🌊' },
  { word: 'sun', meaningKo: '해', emoji: '☀️' },
  { word: 'star', meaningKo: '별', emoji: '⭐' },
];

export class SeaStage extends ChapterStage {
  readonly scene = new Scene();
  private mode: 'runner' | 'sail';
  private lanes: number[];
  private speed: number;
  private env: Environment;
  private fx: Effects;
  private raft = new Group();
  private hero: Group;
  private rig: HumanoidRig;
  private rng: Rng;
  private length: number;
  private z = 0;
  private lane = 1;
  private x = 0;
  private y = 0;
  private vy = 0;
  private hp = MAX_HP;
  private invuln = 0;
  private running = false;
  private started = false;
  /** 문·보스 앞에서 멈춤 (줄 바꾸기는 됨) */
  private halted = false;
  private scarfUsed = false;
  private lastCheckpoint = 0;
  private checkpoints: number[];
  private zonesPassed = new Set<string>();
  private things: Thing[] = [];
  private nextSpawn = 40;
  private nextLetterAt = 30;
  private words: Pick<EnglishWord, 'word' | 'meaningKo' | 'emoji'>[] = [];
  private wordIdx = 0;
  private letterIdx = 0;
  private wordCard = h('div', { class: 'word-card' });
  private bar = h('div');
  private poseidon: Group | null = null;
  private rain: Points | null = null;
  private shake = 0;
  private finishing = false;
  private gates: SeaGate[] = [];
  private boss: SeaBoss | null = null;
  private bossDone = false;

  constructor(chapter: ChapterData, layout: IslandLayout, svc: Services) {
    super(chapter, layout, svc);
    this.mode = chapter.objectives.some((o) => o.type === 'minigame' && o.target === 'waveRunner') ? 'runner' : 'sail';
    const half = (layout.course?.width ?? 12) / 2;
    this.lanes = this.mode === 'runner' ? [-4, 0, 4] : [-half * 0.66, 0, half * 0.66];
    this.speed = this.mode === 'runner' ? 14 : 10;
    this.length = layout.course?.length ?? 900;
    this.checkpoints = layout.checkpoints.map((c) => c.pos[1]).sort((a, b) => a - b);
    this.rng = createRng(layout.terrain.seed);
    this.env = createEnvironment(this.scene, this.mode === 'runner' ? 'storm' : chapter.memory ? 'memory' : 'day');
    this.fx = new Effects(this.scene);

    const raftModel = makeProp('raft');
    alignLengthToZ(raftModel);
    // 돛대·돛(높은 부분)은 숨긴다 — 앞이 잘 보이게 (2장: 폭풍에 부러짐)
    splitByHeight(raftModel, 0.9).tall.forEach((m) => (m.visible = false));
    this.raft.add(raftModel);
    this.hero = getModel('odysseus', { avatar: svc.save.data?.avatar });
    this.hero.position.set(0, 0.4, -0.6);
    this.raft.add(this.hero);
    this.rig = new HumanoidRig(this.hero);
    this.scene.add(this.raft);

    if (this.mode === 'runner') {
      this.poseidon = getModel('poseidon');
      this.poseidon.scale.setScalar(3);
      this.scene.add(this.poseidon);
      this.buildShore();
      this.rain = this.buildRain();
      this.scene.add(this.rain);
      // 2장 이야기 단어(sea, wave, boat …)를 먼저, 그다음 학년에 맞는 바다 단어
      const grade = svc.save.data?.grade ?? 1;
      const fits = (w: EnglishWord) => /^[a-z]{2,6}$/.test(w.word) && w.grade <= grade;
      const story = englishWords.filter((w) => fits(w) && w.chapterHint?.includes('ch02'));
      const sea = englishWords.filter((w) => fits(w) && w.topic === 'sea' && !story.includes(w));
      const seen = new Set<string>();
      this.words = [...this.rng.shuffle(story), ...this.rng.shuffle(sea), ...FALLBACK_WORDS].filter((w) => !seen.has(w.word) && seen.add(w.word));
    } else {
      this.buildCourse();
    }

    this.svc.ui.hud.setHearts(this.hp, MAX_HP);
    this.svc.ui.hud.setCoins(svc.save.data?.coins ?? 0);
    const barWrap = h('div', { class: 'progress-bar' }, this.bar);
    this.svc.ui.hud.setExtra(
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } }, this.mode === 'runner' ? this.wordCard : null, barWrap),
    );
    if (this.mode === 'runner') this.renderWord();
    svc.ui.touch.set('runner');
    this.place();
  }

  override begin() {
    super.begin();
    const touch = this.svc.input.touchMode;
    const hint = this.mode === 'runner'
      ? touch ? '◀ ▶ 로 줄을 바꾸고, ⤴️ 로 파도를 넘어요!' : '← → (A/D) 로 줄 바꾸기 · Space 로 파도 넘기'
      : touch ? '◀ ▶ 로 줄을 바꿔 바위와 소용돌이를 피해요!' : '← → (A/D) 로 줄을 바꿔 바위와 소용돌이를 피해요';
    this.svc.ui.hud.toast(hint, 4500);
  }

  protected setupObjective(o: Objective | null) {
    if (this.mode === 'runner') {
      if (o?.type === 'minigame' && o.target === 'waveRunner') void this.countdown();
    } else if (o && !this.started) {
      // 항해 모드는 첫 목표가 켜지면 출발
      void this.countdown();
    }
  }

  private async countdown() {
    this.started = true;
    this.svc.audio.playBgm(this.chapter.bgm.explore);
    for (const n of ['3', '2', '1', '출발! ⛵']) {
      this.svc.ui.hud.toast(n, 700);
      this.svc.audio.sfx('ui_click');
      await sleep(650);
    }
    this.running = true;
  }

  // ─── 매 프레임 ────────────────────────────────────────────

  update(dt: number, input: InputFrame) {
    this.time += dt;
    const active = this.running && !this.isBlocked && !this.finishing;
    if (active) {
      if (input.left) this.lane = Math.max(0, this.lane - 1);
      if (input.right) this.lane = Math.min(2, this.lane + 1);
      if (input.jump && this.y <= 0.01) {
        this.vy = JUMP;
        this.svc.audio.sfx('jump');
      }
      if (!this.halted) this.z += this.speed * dt;
      if (this.mode === 'runner') this.spawnAhead();
      else {
        this.checkGates();
        this.checkBoss();
      }
      this.checkZones();
    }
    this.invuln = Math.max(0, this.invuln - dt);
    // 줄 바꾸기·점프
    this.x += (this.lanes[this.lane] - this.x) * Math.min(1, dt * 10);
    if (this.y > 0 || this.vy > 0) {
      this.vy -= GRAV * dt;
      this.y = Math.max(0, this.y + this.vy * dt);
      if (this.y === 0) this.vy = 0;
    }
    if (active) this.collide();
    this.updateThings(dt, active);
    if (this.boss) this.updateBoss(dt, active);
    this.place();

    this.rig.update(dt, { speed: 0, grounded: this.y <= 0.01, swing: null, combo: 0 });
    this.hero.visible = this.invuln <= 0 || Math.floor(this.invuln * 12) % 2 === 0;
    this.bar.style.width = `${Math.min(100, (this.z / this.length) * 100)}%`;

    if (this.poseidon) {
      // 포세이돈은 앞쪽 바다에서 지켜본다
      const pz = Math.min(this.z + 140, this.length * 0.85);
      this.poseidon.position.set(34, -8 + Math.sin(this.time * 0.6) * 1.5, pz);
      this.poseidon.rotation.y = -Math.PI / 2 - 0.4;
      this.poseidon.visible = this.z < this.length * 0.8;
    }
    if (this.rain) {
      const arr = (this.rain.geometry.attributes.position as BufferAttribute).array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= dt * 28;
        if (arr[i + 1] < -1) {
          arr[i] = (Math.random() - 0.5) * 60;
          arr[i + 1] = 20 + Math.random() * 10;
          arr[i + 2] = (Math.random() - 0.3) * 70;
        }
      }
      (this.rain.geometry.attributes.position as BufferAttribute).needsUpdate = true;
      this.rain.position.set(this.x, 0, this.z);
      if (Math.random() < dt * 0.12) {
        this.svc.ui.screens.flash();
        this.svc.audio.sfx('thunder', { volume: 0.6 });
      }
    }

    // 카메라 — 세로 화면에서도 세 줄이 모두 보이도록 더 뒤·위에서
    this.shake = Math.max(0, this.shake - dt * 2);
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    const tall = this.camera.aspect < 0.8;
    const wide = this.mode === 'sail' ? 1.25 : 1;
    const back = (tall ? 15 : 9.5) * wide;
    const up = (tall ? 8.5 : 5) * wide;
    this.camera.position.set(this.x * 0.4 + sx, this.raft.position.y + up + sy, this.z - back);
    this.camera.lookAt(this.x * 0.5, 0.5, this.z + (tall ? 12 : 10));

    this.env.follow(new Vector3(this.x, 0, this.z));
    this.env.update(this.time);
    this.fx.update(dt);

    if (active && this.z >= this.length - 12) {
      if (this.mode === 'runner') void this.finishRun();
      else this.running = false;
    }
  }

  private place() {
    const wave = this.env.waterHeight(this.x, this.z, this.time);
    this.raft.position.set(this.x, wave + 0.1 + this.y, this.z);
    this.raft.rotation.z = Math.sin(this.time * 1.7) * 0.08 + (this.lanes[this.lane] - this.x) * -0.05;
    this.raft.rotation.x = Math.cos(this.time * 1.3) * 0.06;
  }

  // ─── 러너: 장애물·글자 ────────────────────────────────────

  private spawnAhead() {
    const horizon = this.z + 90;
    while (this.nextSpawn < horizon && this.nextSpawn < this.length - 30) {
      const at = this.nextSpawn;
      const nearCalm = this.checkpoints.some((c) => c > 0 && Math.abs(c - at) < 25);
      if (!nearCalm) this.spawnPattern(at);
      this.nextSpawn += 18 + this.rng.next() * 12;
    }
    while (this.nextLetterAt < horizon && this.nextLetterAt < this.length - 30) {
      this.spawnLetters(this.nextLetterAt);
      this.nextLetterAt += 34 + this.rng.next() * 10;
    }
  }

  private spawnPattern(z: number) {
    const r = this.rng.next();
    const progress = z / this.length;
    if (r < 0.45) {
      // 바위 1~2개 (빈 줄은 꼭 남긴다)
      const lanes = this.rng.shuffle([0, 1, 2]).slice(0, progress > 0.4 && this.rng.chance(0.5) ? 2 : 1);
      for (const lane of lanes) {
        const rock = makeProp('rock');
        rock.scale.setScalar(1.4);
        this.addThing({ kind: 'rock', lane, z, obj: rock });
      }
    } else if (r < 0.75) {
      const wave = new Mesh(new BoxGeometry(13, 1.4, 1.4), new MeshToonMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.85 }));
      const crest = block(13.2, 0.35, 0.6, '#ffffff', 0, 0.8, 0.2);
      wave.add(crest);
      this.addThing({ kind: 'wave', lane: -1, z, obj: wave });
    } else {
      // 번개: 지금 있는 줄을 노린다 (예고 1.3초)
      const glow = new Mesh(new BoxGeometry(3.2, 0.1, 10), new MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.0, depthWrite: false }));
      this.addThing({ kind: 'bolt', lane: this.lane, z, obj: glow, t: 1.3 });
    }
  }

  private spawnLetters(z: number) {
    const word = this.words[this.wordIdx % this.words.length].word;
    const need = word[this.letterIdx];
    const lanes = this.rng.shuffle([0, 1, 2]);
    this.addLetter(need, lanes[0], z);
    if (this.rng.chance(0.6)) {
      const decoys = 'abcdefghijklmnopqrstuvwxyz'.split('').filter((c) => c !== need);
      this.addLetter(this.rng.pick(decoys), lanes[1], z);
    }
  }

  private addLetter(letter: string, lane: number, z: number) {
    const ball = new Mesh(new SphereGeometry(0.75, 14, 10), new MeshBasicMaterial({ color: '#4aa8ff', transparent: true, opacity: 0.75 }));
    const tag = label(letter.toUpperCase(), 'letter-bubble');
    ball.add(tag);
    this.addThing({ kind: 'letter', lane, z, obj: ball, letter, tag });
  }

  private addThing(t: Thing) {
    t.obj.position.set(t.lane >= 0 ? this.lanes[t.lane] : 0, 0, t.z);
    this.scene.add(t.obj);
    this.things.push(t);
  }

  private updateThings(dt: number, active: boolean) {
    for (const t of this.things) {
      const wave = this.env.waterHeight(t.obj.position.x, t.z, this.time);
      if (t.kind === 'letter') t.obj.position.y = wave + 1.4 + Math.sin(this.time * 3 + t.z) * 0.2;
      else if (t.kind === 'wave') t.obj.position.y = wave + 0.5;
      else if (t.kind === 'rock') t.obj.position.y = wave - 0.6;
      else if (t.kind === 'pool') {
        t.obj.position.y = wave + 0.05;
        t.obj.rotation.y += dt * 2.5;
      } else if (t.kind === 'bolt' && active && !t.done) {
        if (!t.armed) {
          if (this.z < t.z - 12) continue;
          t.armed = true;
          t.lane = this.lane;
          this.svc.audio.sfx('magic', { volume: 0.5 });
        }
        t.t! -= dt;
        t.z = this.z + 3;
        t.obj.position.set(this.lanes[t.lane], wave + 0.2, t.z);
        const m = (t.obj as Mesh).material as MeshBasicMaterial;
        m.opacity = 0.25 + 0.35 * Math.abs(Math.sin(this.time * 12));
        if (t.t! <= 0) {
          t.done = true;
          this.svc.ui.screens.flash();
          this.svc.audio.sfx('thunder');
          this.fx.burst(new Vector3(this.lanes[t.lane], 2, this.z + 2), '#fff6a8', 30, 6, 6);
          if (this.lane === t.lane && this.y < 2) this.hurt();
          t.obj.removeFromParent();
        }
      }
    }
    // 지나간 것 정리
    this.things = this.things.filter((t) => {
      const gone = t.done || t.z < this.z - 8;
      if (gone) {
        t.obj.removeFromParent();
        t.tag?.element.remove();
      }
      return !gone;
    });
  }

  private collide() {
    for (const t of this.things) {
      if (t.done || Math.abs(t.z - this.z) > 1.3) continue;
      if ((t.kind === 'rock' || t.kind === 'pool') && t.lane === this.lane && this.y < 1.2) {
        t.done = true;
        this.fx.burst(t.obj.position.clone().setY(1), t.kind === 'pool' ? '#7fd3ff' : '#9aa3ad', 14, 4, 3);
        if (t.kind === 'pool') this.svc.audio.sfx('whirlpool');
        this.hurt();
      } else if (t.kind === 'wave' && this.y < 0.9) {
        t.done = true;
        this.fx.burst(new Vector3(this.x, 1.2, this.z), '#ffffff', 20, 5, 4);
        this.svc.audio.sfx('splash');
        this.hurt();
      } else if (t.kind === 'letter' && t.lane === this.lane) {
        t.done = true;
        this.collectLetter(t.letter!, t.obj.position.clone());
      }
    }
  }

  private collectLetter(letter: string, at: Vector3) {
    const w = this.words[this.wordIdx % this.words.length];
    if (letter !== w.word[this.letterIdx]) {
      this.svc.audio.sfx('hint', { volume: 0.5 });
      this.fx.burst(at, '#9fb7d8', 8, 2, 1);
      this.svc.ui.hud.toast(`다음 글자는 '${w.word[this.letterIdx].toUpperCase()}' 예요`, 1200);
      return;
    }
    this.letterIdx++;
    this.svc.audio.sfx('coin', { pitch: 1 + this.letterIdx * 0.1 });
    this.fx.burst(at, '#7fd3ff', 16, 4, 3);
    if (this.letterIdx >= w.word.length) {
      this.svc.audio.sfx('combo');
      this.svc.ui.hud.toast(`${w.emoji} ${w.word} = ${w.meaningKo}!`, 2000);
      this.svc.addCoins(2);
      this.wordIdx++;
      this.letterIdx = 0;
    }
    this.renderWord();
  }

  private renderWord() {
    const w = this.words[this.wordIdx % this.words.length];
    const letters = h('div', { class: 'letters' }, ...[...w.word].map((c, i) => h('span', { class: i < this.letterIdx ? 'got' : '', text: i < this.letterIdx ? c : '' })));
    this.wordCard.replaceChildren(h('span', { class: 'emoji', text: w.emoji }), h('span', { text: w.meaningKo }), letters);
  }

  // ─── 항해: 코스·바다 위 문·보스 ───────────────────────────

  /** 섬 데이터의 소품을 놓는다 — 줄 위의 바위·소용돌이는 장애물, 나머지(절벽 등)는 풍경 */
  private buildCourse() {
    for (const p of this.layout.props) {
      if (this.hazardLane(p.model, p.pos[0]) >= 0) continue;
      const obj = makeProp(p.model);
      obj.position.set(p.pos[0], -0.8, p.pos[1]);
      obj.rotation.y = p.rotY ?? 0;
      obj.scale.setScalar(p.scale ?? 1);
      this.scene.add(obj);
    }
    this.addCourseHazards(0);
    const width = (this.layout.course?.width ?? 12) + 1;
    for (const g of this.layout.gates.filter((x) => x.chapter === this.chapter.id)) {
      const obj = buildGate(width);
      obj.position.set(0, -0.6, g.pos[1]);
      obj.rotation.y = g.rotY;
      this.scene.add(obj);
      this.gates.push({ z: g.pos[1], slot: g.quizSlot, obj, open: false, asking: false });
    }
  }

  /** 그 소품이 어느 줄의 장애물인지 (-1 이면 풍경) */
  private hazardLane(model: PropId, x: number): number {
    if (!HAZARD_PROPS[model]) return -1;
    let best = 0;
    for (let i = 1; i < this.lanes.length; i++) if (Math.abs(x - this.lanes[i]) < Math.abs(x - this.lanes[best])) best = i;
    return Math.abs(x - this.lanes[best]) <= 1.8 ? best : -1;
  }

  private addCourseHazards(fromZ: number) {
    for (const p of this.layout.props) {
      const lane = this.hazardLane(p.model, p.pos[0]);
      if (lane < 0 || p.pos[1] < fromZ) continue;
      const obj = makeProp(p.model);
      obj.scale.setScalar((p.scale ?? 1) * 1.2);
      this.addThing({ kind: HAZARD_PROPS[p.model]!, lane, z: p.pos[1], obj });
    }
  }

  private checkGates() {
    for (const g of this.gates) {
      if (g.open || g.asking || this.z < g.z - 7) continue;
      this.z = g.z - 7;
      void this.openGate(g);
    }
  }

  private async openGate(g: SeaGate) {
    g.asking = true;
    this.halted = true;
    this.svc.ui.hud.toast('🦉 바다 위 지혜의 문! 문제를 풀면 열려요');
    await this.askSlot(g.slot);
    if (this.signal.aborted) return;
    g.obj.traverse((o) => {
      if (o.name === 'barrier') o.visible = false;
    });
    this.svc.audio.sfx('gate_unlock');
    this.fx.burst(new Vector3(0, 2, g.z), '#7fd3ff', 30, 6, 4);
    this.svc.ui.hud.toast('🚪 지혜의 문이 열렸어요!');
    g.open = true;
    g.asking = false;
    this.halted = false;
    this.runner.emit({ type: 'quiz', slot: g.slot });
  }

  private checkBoss() {
    const b = this.layout.boss;
    if (!b || this.bossDone || this.chapter.boss !== b.id) return;
    const triggerZ = b.arenaCenter[1] - b.arenaRadius - 10;
    if (this.z < triggerZ) return;
    if (!this.boss) this.boss = this.makeBoss(b.arenaCenter[1] + b.arenaRadius);
    if (this.boss.active) return;
    this.boss.active = true;
    this.halted = true;
    this.z = triggerZ;
    this.svc.ui.hud.setBoss(this.boss.name, this.boss.hp, this.boss.max);
    this.svc.audio.playBgm(this.chapter.bgm.boss ?? 'boss');
    this.svc.audio.sfx('boss_roar');
    this.shake = 0.6;
    this.svc.ui.hud.toast(`⚔️ ${this.boss.name}! 빨간 줄을 보면 옆 줄로 피해요`, 3200);
  }

  private makeBoss(z: number): SeaBoss {
    const model = getModel(this.layout.boss!.id);
    model.position.set(0, -1.5, z);
    model.rotation.y = Math.PI;
    this.scene.add(model);
    const heads: Object3D[] = [];
    for (let i = 0; i < 6; i++) {
      const head = model.getObjectByName(`head${i}`);
      if (head) heads.push(head);
    }
    const laneWidth = Math.abs(this.lanes[1] - this.lanes[0]) * 0.9;
    const glow = new Mesh(new BoxGeometry(laneWidth, 0.12, 9), new MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.4, depthWrite: false }));
    glow.visible = false;
    this.scene.add(glow);
    return { name: '머리 여섯 스킬라', model, heads, glow, hp: 8, max: 8, t: 0, phase: 'idle', lane: 1, strikes: 0, busy: false, active: false, lunge: 0, head: 0 };
  }

  private updateBoss(dt: number, active: boolean) {
    const s = this.boss!;
    s.model.position.y = -1.5 + Math.sin(this.time * 1.3) * 0.3;
    s.heads.forEach((head, i) => (head.rotation.x = Math.sin(this.time * 2 + i) * 0.15));
    if (s.lunge > 0) {
      s.lunge = Math.max(0, s.lunge - dt);
      const head = s.heads[s.head];
      if (head) head.rotation.x = 0.9 * (s.lunge / 0.4);
    }
    if (!s.active || s.busy || !active) return;
    s.t += dt;
    if (s.phase === 'idle' && s.t > 1.0) {
      // 대개는 뗏목이 있는 줄을 노린다
      s.lane = Math.random() < 0.7 ? this.lane : Math.floor(Math.random() * 3);
      s.phase = 'warn';
      s.t = 0;
      s.glow.visible = true;
      s.glow.position.set(this.lanes[s.lane], this.env.waterHeight(this.lanes[s.lane], this.z, this.time) + 0.15, this.z + 2);
      this.svc.audio.sfx('magic', { volume: 0.5 });
    } else if (s.phase === 'warn') {
      (s.glow.material as MeshBasicMaterial).opacity = 0.25 + 0.35 * Math.abs(Math.sin(this.time * 10));
      if (s.t > 1.2) {
        s.glow.visible = false;
        s.lunge = 0.4;
        s.head = s.strikes % Math.max(1, s.heads.length);
        this.fx.burst(new Vector3(this.lanes[s.lane], 1, this.z + 2), '#7fd3ff', 24, 5, 4);
        this.svc.audio.sfx('splash');
        this.shake = Math.max(this.shake, 0.4);
        if (this.lane === s.lane && this.y < 2) this.hurt();
        s.strikes++;
        s.phase = 'idle';
        s.t = 0;
        if (s.strikes % 3 === 0) void this.bossWeak();
      }
    }
  }

  private async bossWeak() {
    const s = this.boss;
    if (!s || s.busy) return;
    s.busy = true;
    s.glow.visible = false;
    this.svc.ui.hud.toast('⚡ 스킬라가 지쳤어요! 문제를 맞혀 공격해요!');
    const slot = this.chapter.quizSlots.find((q) => q.placement === 'boss');
    const firstTry = await this.ask(slot, 'boss');
    if (this.signal.aborted) return;
    s.hp = Math.max(0, s.hp - (firstTry ? 4 : 2));
    this.svc.ui.hud.setBoss(s.name, s.hp, s.max);
    this.svc.audio.sfx('boss_hit');
    this.fx.burst(s.model.position.clone().setY(4), '#ffe066', 30, 6, 4);
    this.shake = 0.6;
    s.busy = false;
    s.phase = 'idle';
    s.t = 0;
    if (s.hp <= 0) void this.bossDefeated();
  }

  private async bossDefeated() {
    const s = this.boss!;
    s.active = false;
    this.bossDone = true;
    this.svc.audio.sfx('boss_defeat');
    this.fx.burst(s.model.position.clone().setY(3), '#ffe066', 60, 8, 6);
    this.svc.ui.hud.setBoss(null);
    this.svc.addCoins(5);
    this.svc.audio.playBgm(this.chapter.bgm.explore);
    this.runner.emit({ type: 'boss', id: this.layout.boss!.id });
    // 바닷속으로 가라앉는다
    const t0 = performance.now();
    while (performance.now() - t0 < 1200) {
      if (this.signal.aborted) return;
      s.model.position.y = -1.5 - ((performance.now() - t0) / 1200) * 8;
      await sleep(16);
    }
    s.model.removeFromParent();
    s.glow.removeFromParent();
    this.halted = false;
  }

  // ─── 공통: 다침·부서짐·구역 ───────────────────────────────

  private hurt() {
    if (this.invuln > 0) return;
    this.hp--;
    this.invuln = 1.5;
    this.shake = 0.8;
    this.svc.audio.sfx('player_hurt');
    this.svc.ui.hud.flashHurt();
    this.svc.ui.hud.setHearts(this.hp, MAX_HP);
    if (this.hp <= 0) void this.broken();
  }

  private async broken() {
    this.running = false;
    const canScarf = this.mode === 'runner' && !this.scarfUsed && this.layout.zones.some((z) => z.id === 'ino-scarf');
    if (canScarf) {
      this.scarfUsed = true;
      this.runner.emit({ type: 'zone', zone: 'ino-scarf' });
      await this.runner.idle();
      this.svc.ui.hud.toast('🧣 이노의 스카프! 뗏목이 다시 튼튼해졌어요', 2600);
    } else {
      await this.svc.ui.screens.fade(true, 350);
      this.z = this.lastCheckpoint;
      this.clearAhead();
      if (this.boss?.active) {
        // 보스는 체력을 그대로 둔 채 쉬었다가, 다시 다가가면 이어서 싸운다
        this.boss.active = false;
        this.boss.glow.visible = false;
        this.boss.phase = 'idle';
        this.svc.ui.hud.setBoss(null);
      }
      this.halted = false;
      await this.svc.ui.screens.fade(false, 350);
      this.svc.ui.hud.toast('🚩 체크포인트에서 다시! 할 수 있어요 💪', 2400);
    }
    this.hp = MAX_HP;
    this.invuln = 2;
    this.svc.ui.hud.setHearts(this.hp, MAX_HP);
    await sleep(600);
    this.running = true;
  }

  private clearAhead() {
    for (const t of this.things) {
      t.obj.removeFromParent();
      t.tag?.element.remove();
    }
    this.things = [];
    this.nextSpawn = this.z + 30;
    this.nextLetterAt = this.z + 20;
    if (this.mode === 'sail') this.addCourseHazards(this.z + 5);
  }

  private checkZones() {
    for (const c of this.checkpoints) if (this.z >= c && c > this.lastCheckpoint) this.lastCheckpoint = c;
    for (const zone of this.layout.zones) {
      if (zone.id === 'ino-scarf' || zone.id === 'shore' || this.zonesPassed.has(zone.id)) continue;
      if (this.z >= zone.center[1]) {
        this.zonesPassed.add(zone.id);
        this.runner.emit({ type: 'zone', zone: zone.id });
      }
    }
  }

  private async finishRun() {
    this.finishing = true;
    this.running = false;
    this.clearAhead();
    this.svc.audio.sfx('victory');
    this.svc.ui.hud.toast('🏝️ 육지에 닿았어요!', 2000);
    const start = this.z;
    const t0 = performance.now();
    while (performance.now() - t0 < 1500) {
      this.z = start + ((performance.now() - t0) / 1500) * 10;
      await sleep(16);
    }
    this.svc.ui.hud.setExtra(null);
    this.runner.emit({ type: 'minigame', id: 'waveRunner' });
  }

  // ─── 꾸미기 ───────────────────────────────────────────────

  private buildShore() {
    const shore = new Group();
    const L = this.length;
    shore.add(block(70, 2, 30, '#e6c98c', 0, 0, L + 22));
    shore.add(block(50, 3, 18, '#7cc45a', 0, 1, L + 34));
    for (const [x, dz] of [[-14, 18], [10, 20], [22, 26], [-24, 28]]) {
      const p = makeProp('palmTree');
      p.position.set(x, 1, L + dz);
      shore.add(p);
    }
    this.scene.add(shore);
  }

  private buildRain(): Points {
    const n = 1400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = Math.random() * 30;
      pos[i * 3 + 2] = (Math.random() - 0.3) * 70;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    const pts = new Points(geo, new PointsMaterial({ color: '#cfe0ff', size: 0.12, transparent: true, opacity: 0.6, depthWrite: false, blending: AdditiveBlending }));
    pts.frustumCulled = false;
    return pts;
  }

  override dispose() {
    super.dispose();
    for (const t of this.things) t.tag?.element.remove();
    this.fx.dispose();
    this.svc.ui.hud.setExtra(null);
    this.svc.ui.hud.setBoss(null);
  }
}
