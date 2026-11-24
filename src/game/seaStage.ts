/**
 * 바다 코스 장면 — 두 가지 모드.
 * - 러너 (2장 '폭풍 파도 러너'): 폭풍 속을 달린다. 바위는 옆으로, 큰 파도는 점프, 번개는 예고된 줄을 피하고
 *   영어 글자 방울을 순서대로 모은다. 뗏목이 부서지면 이노의 스카프로 한 번 살아난다.
 * - 항해 (10장 해협처럼 waveRunner 목표가 없는 코스): 섬 데이터의 바위·소용돌이를 줄을 바꿔 피한다.
 *   바다 위 지혜의 문 앞에서 멈춰 퀴즈를 풀고, 보스(스킬라) 무대에서 멈춰 싸운다.
 */
import {
  AdditiveBlending, Box3, BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshToonMaterial, type Object3D, Points, PointsMaterial, RingGeometry, Scene, SphereGeometry, Vector3,
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
import { compactModel } from '../world/merge';
import { Effects, label } from '../play/effects';
import { HumanoidRig } from '../play/rig';
import { englishWords } from '../learning/data';
import { h, sleep } from '../ui/dom';
import { ChapterStage } from './chapterStage';
import { prefs } from './prefs';
import type { Services } from './services';

const MAX_HP = 3;
const JUMP = 9;
/** 떠 있는 시간이 1초쯤 — 파도를 넘는 때를 넉넉하게 맞출 수 있다 */
const GRAV = 18;
/** 다친 뒤 깜빡이며 다치지 않는 시간(초) */
const INVULN = 2;
/** 번개·스킬라가 내리치기 전에 미리 알려 주는 시간(초) */
const BOLT_WARN = 1.8;
const BOSS_WARN = 1.7;
/** 파도와 부딪히는 앞뒤 거리 */
const WAVE_HIT = 0.9;
/** 파도를 넘는 높이 — 점프한 뒤 [AIR_FROM, AIR_TO] 초 동안 이 높이 위에 있다 */
const CLEAR_H = 0.9;
const AIR_D = Math.sqrt(JUMP * JUMP - 2 * GRAV * CLEAR_H);
const AIR_FROM = (JUMP - AIR_D) / GRAV;
const AIR_TO = (JUMP + AIR_D) / GRAV;
/** 줄 사이 부표 간격(m)과 한 줄에 놓는 개수 */
const BUOY_GAP = 9;
const BUOY_N = 14;

/** 바위·소용돌이 둘레의 물거품 고리 — 내 줄로 다가오면 빨갛게 깜빡인다 */
const RING_GEO = new RingGeometry(1, 1.3, 20).rotateX(-Math.PI / 2);
const RING_SAFE = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false });
const RING_DANGER = new MeshBasicMaterial({ color: '#ff4040', transparent: true, opacity: 0.95, depthWrite: false });

type Kind = 'rock' | 'pool' | 'wave' | 'letter' | 'bolt';
interface Thing {
  kind: Kind;
  lane: number;
  z: number;
  obj: Group | Mesh;
  letter?: string;
  tag?: CSS2DObject;
  /** 바위·소용돌이: 물거품 고리와 그 크기 */
  ring?: Mesh;
  ringR?: number;
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
  /** 내리칠 줄 위의 경고 표시 */
  warnTag: CSS2DObject;
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

/**
 * 세 줄의 x 위치 — 0번 줄(◀)이 화면 왼쪽.
 * 바다 카메라는 +z 쪽을 바라보므로 화면 왼쪽이 +x 다 (반대로 두면 ◀ 를 눌렀을 때 배가 오른쪽으로 간다).
 */
export function seaLanes(side: number): number[] {
  return [side, 0, -side];
}

/** 바다 카메라 자리 — 높이서 앞쪽을 내려다봐서, 세로 화면에서도 세 줄과 다가오는 장애물이 오디세우스에 가리지 않는다 */
export function seaCameraPose(x: number, y: number, z: number, aspect: number, sail: boolean, pos: Vector3, look: Vector3) {
  const tall = aspect < 0.8;
  const wide = sail ? 1.2 : 1;
  const back = (tall ? 13 : 9.5) * wide;
  const up = (tall ? 10.5 : 7) * wide;
  pos.set(x * 0.4, y + up, z - back);
  look.set(x * 0.5, 0.3, z + (tall ? 15 : 16));
}

const camPos = new Vector3();
const camLook = new Vector3();
const buoyM = new Matrix4();
const buoyC = new Color();

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
  /** 뗏목이 부서져 다시 시작한 횟수 — 많을수록 바다가 순해진다 (아이가 끝까지 갈 수 있게) */
  private fails = 0;
  /** 줄 사이 부표 (세 줄이 눈에 보이게) */
  private buoys: InstancedMesh;
  /** 처음 본 장애물마다 한 번씩 피하는 법을 알려 준다 */
  private tipped = new Set<Kind>();
  /** 출발 안내가 보이는 동안 (장면 시간) */
  private hintUntil = 0;
  private jumpReady = false;

  constructor(chapter: ChapterData, layout: IslandLayout, svc: Services) {
    super(chapter, layout, svc);
    this.mode = chapter.objectives.some((o) => o.type === 'minigame' && o.target === 'waveRunner') ? 'runner' : 'sail';
    const half = (layout.course?.width ?? 12) / 2;
    // 카메라가 +z 쪽을 바라보므로 화면 왼쪽이 +x 다 — 0번 줄(◀)이 화면 왼쪽에 오게 한다
    this.lanes = seaLanes(this.mode === 'runner' ? 4 : half * 0.66);
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
    this.hero = compactModel(getModel('odysseus', { avatar: svc.save.data?.avatar }));
    this.hero.position.set(0, 0.4, -0.6);
    this.raft.add(this.hero);
    this.rig = new HumanoidRig(this.hero);
    this.scene.add(this.raft);
    this.buoys = new InstancedMesh(new BoxGeometry(0.42, 0.62, 0.42), new MeshToonMaterial({ color: '#ffffff' }), BUOY_N * 2);
    this.buoys.frustumCulled = false;
    this.scene.add(this.buoys);

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
    // 항해에는 넘을 파도가 없으니 점프 버튼을 두지 않는다
    svc.ui.touch.set(this.mode === 'runner' ? 'runner' : 'sail');
    this.place();
    this.placeBuoys();
  }

  /** 출발 직후 조작 안내 — 이 안내가 보이는 동안에는 장애물 안내를 미룬다 (낮은 화면은 알림을 하나만 보여 준다) */
  private showStartHint() {
    const touch = this.svc.input.touchMode;
    const hint = this.mode === 'runner'
      ? touch ? '◀ ▶ 로 줄을 바꾸고, ⤴️ 로 파도를 넘어요! 화면을 밀어도 돼요' : '← → (A/D) 로 줄 바꾸기 · Space 로 파도 넘기'
      : touch ? '◀ ▶ 로 줄을 바꿔 바위와 소용돌이를 피해요! 화면을 밀어도 돼요' : '← → (A/D) 로 줄을 바꿔 바위와 소용돌이를 피해요';
    this.svc.ui.hud.toast(hint, 4500);
    this.hintUntil = this.time + 4;
  }

  /** 멈춤 창의 조작 안내 [터치, 키보드] — 항해에는 점프가 없다 */
  get controlsHelp(): [string, string] {
    return this.mode === 'runner'
      ? ['조작: ◀ ▶ 줄 바꾸기 · ⤴️ 파도 넘기 · 화면을 옆으로 밀어도 줄이 바뀌어요', '조작: ← → (A/D) 줄 바꾸기 · Space 파도 넘기']
      : ['조작: ◀ ▶ 줄 바꾸기 · 화면을 옆으로 밀어도 줄이 바뀌어요', '조작: ← → (A/D) 줄 바꾸기'];
  }

  /** 지금 빠르기 — 러너는 처음 250m 동안 천천히 빨라지고, 다시 시작할수록 느려진다 */
  private get pace() {
    const ramp = this.mode === 'runner' ? 0.75 + 0.25 * Math.min(1, this.z / 250) : 1;
    return this.speed * ramp * (1 - 0.1 * Math.min(3, this.fails));
  }

  /** 처음 보는 장애물마다 한 번, 피하는 법을 알려 준다 */
  private tip(kind: Kind) {
    if (this.tipped.has(kind) || this.time < this.hintUntil) return;
    this.tipped.add(kind);
    const touch = this.svc.input.touchMode;
    const move = touch ? '◀ ▶' : '← →';
    const text: Record<Kind, string> = {
      rock: `🪨 내 줄로 오는 바위는 빨갛게 빛나요. ${move} 로 피해요!`,
      pool: `🌀 소용돌이도 빨갛게 빛나면 ${move} 로 피해요!`,
      wave: touch ? '🌊 큰 파도! ⤴️ 가 반짝일 때 눌러서 넘어요' : '🌊 큰 파도! ⤴️ 가 반짝일 때 Space 로 넘어요',
      bolt: '⚡ 번개가 칠 줄이 노랗게 빛나요! 옆 줄로 비켜요',
      letter: '',
    };
    if (text[kind]) this.svc.ui.hud.toast(text[kind], 3400);
  }

  private setJumpReady(on: boolean) {
    if (on === this.jumpReady) return;
    this.jumpReady = on;
    this.svc.ui.touch.setJumpReady(on);
  }

  /** lane 말고 다른 줄 가운데, 앞으로 sec 초 동안 바위·소용돌이가 없는 줄이 있는가 */
  private canDodge(lane: number, sec: number): boolean {
    const reach = this.z + this.pace * sec + 4;
    return [0, 1, 2].some((l) => l !== lane && !this.things.some((t) =>
      (t.kind === 'rock' || t.kind === 'pool') && !t.done && t.lane === l && t.z > this.z - 1 && t.z < reach));
  }

  /** 줄 사이 부표 — 뗏목 앞뒤로만 놓고, 지나가면 앞으로 옮긴다 */
  private placeBuoys() {
    const first = Math.floor((this.z - 12) / BUOY_GAP);
    for (let i = 0; i < BUOY_N; i++) {
      const n = first + i;
      const z = n * BUOY_GAP;
      for (let s = 0; s < 2; s++) {
        const x = (this.lanes[s] + this.lanes[s + 1]) / 2;
        const y = z < this.length - 6 ? this.env.waterHeight(x, z, this.time) + 0.1 : -50;
        buoyM.makeTranslation(x, y, z);
        this.buoys.setMatrixAt(i * 2 + s, buoyM);
        this.buoys.setColorAt(i * 2 + s, buoyC.set(n % 2 ? '#ffffff' : '#ff8a3d'));
      }
    }
    this.buoys.instanceMatrix.needsUpdate = true;
    if (this.buoys.instanceColor) this.buoys.instanceColor.needsUpdate = true;
  }

  /** 바위·소용돌이 둘레에 물거품 고리를 단다 */
  private withRing(t: Thing): Thing {
    const size = new Box3().setFromObject(t.obj).getSize(new Vector3());
    t.ringR = Math.max(1.2, Math.max(size.x, size.z) * 0.55);
    t.ring = new Mesh(RING_GEO, RING_SAFE);
    t.ring.position.set(t.lane >= 0 ? this.lanes[t.lane] : 0, 0, t.z);
    t.ring.scale.setScalar(t.ringR);
    this.scene.add(t.ring);
    return t;
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
    if (this.signal.aborted) return;
    this.started = true;
    this.svc.audio.playBgm(this.chapter.bgm.explore);
    for (const n of ['3', '2', '1', '출발! ⛵']) {
      if (this.signal.aborted) return;
      this.svc.ui.hud.toast(n, 700);
      this.svc.audio.sfx('ui_click');
      await sleep(650);
    }
    if (this.signal.aborted) return;
    this.running = true;
    this.showStartHint();
  }

  // ─── 매 프레임 ────────────────────────────────────────────

  update(dt: number, input: InputFrame) {
    this.time += dt;
    const active = this.running && !this.isBlocked && !this.finishing;
    if (active) {
      if (input.left) this.lane = Math.max(0, this.lane - 1);
      if (input.right) this.lane = Math.min(2, this.lane + 1);
      // 항해(10장)에는 넘을 파도가 없다 — 터치에 점프 버튼이 없으니 키보드도 같게
      if (input.jump && this.mode === 'runner' && this.y <= 0.01) {
        this.vy = JUMP;
        this.svc.audio.sfx('jump');
      }
      if (!this.halted) this.z += this.pace * dt;
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
    this.placeBuoys();

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

    // 카메라 — 높이서 앞을 내려다봐서 세로 화면에서도 세 줄과 다가오는 장애물이 보이게
    this.shake = Math.max(0, this.shake - dt * 2);
    const shake = prefs.calm ? 0 : this.shake;
    seaCameraPose(this.x, this.raft.position.y, this.z, this.camera.aspect, this.mode === 'sail', camPos, camLook);
    camPos.x += (Math.random() - 0.5) * shake;
    camPos.y += (Math.random() - 0.5) * shake;
    this.camera.position.copy(camPos);
    this.camera.lookAt(camLook);

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
      this.nextSpawn += (18 + this.rng.next() * 12) * (this.fails >= 2 ? 1.5 : 1);
    }
    while (this.nextLetterAt < horizon && this.nextLetterAt < this.length - 30) {
      this.spawnLetters(this.nextLetterAt);
      this.nextLetterAt += 34 + this.rng.next() * 10;
    }
  }

  private spawnPattern(z: number) {
    const progress = z / this.length;
    // 하나씩 익히게 — 처음에는 바위만, 120m 부터 파도, 230m 부터 번개
    const r = this.rng.next() * (z < 120 ? 0.45 : z < 230 ? 0.75 : 1);
    if (r < 0.45) {
      // 바위 1~2개 (빈 줄은 꼭 남긴다)
      const lanes = this.rng.shuffle([0, 1, 2]).slice(0, progress > 0.4 && this.fails < 2 && this.rng.chance(0.5) ? 2 : 1);
      for (const lane of lanes) {
        const rock = compactModel(makeProp('rock'));
        rock.scale.setScalar(1.4);
        this.addThing(this.withRing({ kind: 'rock', lane, z, obj: rock }));
      }
    } else if (r < 0.75) {
      const wave = new Mesh(new BoxGeometry(13, 1.4, 1.4), new MeshToonMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.85 }));
      const crest = block(13.2, 0.35, 0.6, '#ffffff', 0, 0.8, 0.2);
      wave.add(crest);
      // 뗏목 바로 앞에 ⤴️ — 지금 누르면 넘을 수 있을 때 반짝인다
      const tag = label('⤴️', 'hazard-tag jump');
      tag.position.set(0, 2.2, 0);
      wave.add(tag);
      this.addThing({ kind: 'wave', lane: -1, z, obj: wave, tag });
    } else {
      // 번개: 뗏목이 다가오면 그때 있는 줄을 노린다 (예고 BOLT_WARN 초)
      const glow = new Mesh(new BoxGeometry(3.2, 0.1, 10), new MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.0, depthWrite: false }));
      const tag = label('⚡', 'hazard-tag');
      tag.position.set(0, 2.4, -2);
      tag.visible = false;
      glow.add(tag);
      this.addThing({ kind: 'bolt', lane: this.lane, z, obj: glow, t: BOLT_WARN, tag });
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
    // 지금 누르면 파도를 넘을 수 있는 앞쪽 거리 (떠 있는 시간 × 빠르기, 앞뒤로 조금 여유)
    const pace = this.pace;
    const jumpFrom = WAVE_HIT + pace * AIR_FROM + 0.3;
    const jumpTo = pace * AIR_TO - WAVE_HIT - 0.3;
    let ready = false;
    for (const t of this.things) {
      const wave = this.env.waterHeight(t.obj.position.x, t.z, this.time);
      const dz = t.z - this.z;
      if (active && !t.done && t.kind !== 'bolt' && dz > 0 && dz < 30) this.tip(t.kind);
      if (t.kind === 'letter') t.obj.position.y = wave + 1.4 + Math.sin(this.time * 3 + t.z) * 0.2;
      else if (t.kind === 'wave') {
        t.obj.position.y = wave + 0.5;
        const go = active && !t.done && this.y <= 0.01 && dz >= jumpFrom && dz <= jumpTo;
        if (t.tag) {
          t.tag.position.x = this.x - t.obj.position.x;
          t.tag.element.classList.toggle('go', go);
        }
        ready ||= go;
      } else if (t.kind === 'rock' || t.kind === 'pool') {
        if (t.kind === 'rock') t.obj.position.y = wave - 0.6;
        else {
          t.obj.position.y = wave + 0.05;
          t.obj.rotation.y += dt * 2.5;
        }
        if (t.ring) {
          // 내 줄로 다가오는 것만 빨갛게 — 어느 쪽으로 피할지 한눈에
          const danger = !t.done && t.lane === this.lane && dz > -1 && dz < 32;
          t.ring.material = danger ? RING_DANGER : RING_SAFE;
          t.ring.scale.setScalar(t.ringR! * (danger && !prefs.calm ? 1 + Math.sin(this.time * 10) * 0.1 : 1));
          t.ring.position.set(t.obj.position.x, wave + 0.12, t.z);
        }
      } else if (t.kind === 'bolt' && active && !t.done) {
        if (!t.armed) {
          if (this.z < t.z - 12) continue;
          // 비켜설 줄이 모두 바위로 막혀 있으면 이번 번개는 치지 않는다
          if (!this.canDodge(this.lane, BOLT_WARN)) {
            t.done = true;
            continue;
          }
          t.armed = true;
          t.lane = this.lane;
          if (t.tag) t.tag.visible = true;
          this.tip('bolt');
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
    this.setJumpReady(ready);
    // 지나간 것 정리
    this.things = this.things.filter((t) => {
      const gone = t.done || t.z < this.z - 8;
      if (gone) {
        t.obj.removeFromParent();
        t.ring?.removeFromParent();
        t.tag?.element.remove();
      }
      return !gone;
    });
  }

  private collide() {
    for (const t of this.things) {
      if (t.done || Math.abs(t.z - this.z) > (t.kind === 'wave' ? WAVE_HIT : 1.3)) continue;
      if ((t.kind === 'rock' || t.kind === 'pool') && t.lane === this.lane && this.y < 1.2) {
        t.done = true;
        this.fx.burst(t.obj.position.clone().setY(1), t.kind === 'pool' ? '#7fd3ff' : '#9aa3ad', 14, 4, 3);
        if (t.kind === 'pool') this.svc.audio.sfx('whirlpool');
        this.hurt();
      } else if (t.kind === 'wave' && this.y < CLEAR_H) {
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
      const obj = compactModel(makeProp(p.model));
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
      const obj = compactModel(makeProp(p.model));
      obj.scale.setScalar((p.scale ?? 1) * 1.2);
      this.addThing(this.withRing({ kind: HAZARD_PROPS[p.model]!, lane, z: p.pos[1], obj }));
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
    const model = compactModel(getModel(this.layout.boss!.id));
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
    // 빨간색만으로 알리지 않도록 줄 위에 경고 표시도 띄운다
    const warnTag = label('⚠️', 'hazard-tag');
    warnTag.position.set(0, 2.4, -1.5);
    glow.add(warnTag);
    this.scene.add(glow);
    return { name: '머리 여섯 스킬라', model, heads, glow, hp: 8, max: 8, t: 0, phase: 'idle', lane: 1, warnTag, strikes: 0, busy: false, active: false, lunge: 0, head: 0 };
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
      if (s.t > BOSS_WARN) {
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
    // 세 번 넘게 다시 시작했다면 마지막 하트는 지켜 준다 — 언젠가는 꼭 지나갈 수 있게
    this.hp = this.fails >= 3 ? Math.max(1, this.hp - 1) : this.hp - 1;
    this.invuln = INVULN;
    this.shake = 0.8;
    this.svc.audio.sfx('player_hurt');
    this.svc.ui.hud.flashHurt();
    this.svc.ui.hud.setHearts(this.hp, MAX_HP);
    if (this.hp <= 0) void this.broken();
  }

  private async broken() {
    if (this.signal.aborted) return;
    this.running = false;
    const canScarf = this.mode === 'runner' && !this.scarfUsed && this.layout.zones.some((z) => z.id === 'ino-scarf');
    if (canScarf) {
      this.scarfUsed = true;
      this.runner.emit({ type: 'zone', zone: 'ino-scarf' });
      await this.runner.idle();
      if (this.signal.aborted) return;
      this.svc.ui.hud.toast('🧣 이노의 스카프! 뗏목이 다시 튼튼해졌어요', 2600);
    } else {
      await this.svc.ui.screens.fade(true, 350);
      if (this.signal.aborted) return;
      this.fails++;
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
      if (this.signal.aborted) return;
      this.svc.ui.hud.toast(this.fails >= 2 ? '🌊 바다가 조금 잔잔해졌어요. 천천히 가 봐요!' : '🚩 체크포인트에서 다시! 할 수 있어요 💪', 2400);
    }
    this.hp = MAX_HP;
    this.invuln = 2;
    this.svc.ui.hud.setHearts(this.hp, MAX_HP);
    await sleep(600);
    if (this.signal.aborted) return;
    this.running = true;
  }

  private clearAhead() {
    for (const t of this.things) {
      t.obj.removeFromParent();
      t.ring?.removeFromParent();
      t.tag?.element.remove();
    }
    this.setJumpReady(false);
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
    if (this.signal.aborted) return;
    this.finishing = true;
    this.running = false;
    this.clearAhead();
    this.svc.audio.sfx('victory');
    this.svc.ui.hud.toast('🏝️ 육지에 닿았어요!', 2000);
    const start = this.z;
    const t0 = performance.now();
    while (performance.now() - t0 < 1500) {
      if (this.signal.aborted) return;
      this.z = start + ((performance.now() - t0) / 1500) * 10;
      await sleep(16);
    }
    if (this.signal.aborted) return;
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
      const p = compactModel(makeProp('palmTree'));
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
    this.boss?.warnTag.element.remove();
    this.svc.ui.touch.setJumpReady(false);
    this.fx.dispose();
    this.svc.ui.hud.setExtra(null);
    this.svc.ui.hud.setBoss(null);
  }
}
