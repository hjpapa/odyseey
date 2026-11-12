/**
 * 섬 장면 — 플레이어·NPC·적·줍기·지혜의 문·부엉이 신전·보물상자·체크포인트·길잡이 빛.
 */
import {
  ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshToonMaterial,
  type Object3D, type Scene, Vector3,
} from 'three';
import {
  BOSS_IDS, DEFAULT_AVATAR, MINIGAME_IDS, PROP_IDS,
  type BossId, type ChapterData, type IslandLayout, type MinigameId, type ModelId, type Objective, type PropId, type XZ,
} from '../types/contracts';
import type { InputFrame } from '../core/input';
import { getModel } from '../core/models';
import { IslandWorld, type Collider } from '../world/island';
import { buildGate, gateColliders, glowRing } from '../world/gates';
import { makeProp } from '../world/props';
import { FollowCamera } from '../play/camera';
import { Effects } from '../play/effects';
import { Player, type Hittable } from '../play/player';
import { Enemy, type EnemySpec } from '../play/enemy';
import { Npc } from '../play/npc';
import { Hazards, IMPACT_STYLE } from '../play/hazards';
import { BossFight, type BossArena, type BossHost } from '../play/bossFight';
import { bossFactory } from '../enemies/bosses';
import { ISLAND_MINIGAMES, MINIGAME_LABEL } from '../story/minigames';
import { ChapterStage } from './chapterStage';
import type { Services } from './services';

interface Interactable {
  pos: Vector3;
  range: number;
  label(): string | null;
  act(): Promise<void>;
}

interface Pickup {
  item: string;
  obj: Object3D;
  pos: Vector3;
  taken: boolean;
  phase: number;
}

const ENEMY_SPECS: Partial<Record<ModelId, EnemySpec>> = {
  greekSoldier: { model: 'greekSoldier', hp: 4, speed: 3.4, damage: 1, aggro: 11, windup: 0.75 },
  lotusEater: { model: 'lotusEater', hp: 3, speed: 2.8, damage: 1, aggro: 9, windup: 0.9 },
  laestrygonian: { model: 'laestrygonian', hp: 6, speed: 2.6, damage: 1, aggro: 12, windup: 1.0 },
  suitor: { model: 'suitor', hp: 3, speed: 3.2, damage: 1, aggro: 10, windup: 0.8 },
  siren: { model: 'siren', hp: 3, speed: 3.0, damage: 1, aggro: 10, windup: 0.8 },
};
/** 그룹별 조정 — 1장 연습 그림자는 느리고 약하게 */
const GROUP_SPECS: Record<string, Partial<EnemySpec>> = {
  shadows: { shadow: true, hp: 3, speed: 2.6, aggro: 9, windup: 1.05 },
};
/** 아이템 이름 → 모델 */
const ITEM_MODEL: Record<string, ModelId> = { log: 'log', moly: 'molyFlower', crew: 'crewman', coin: 'coin', lotus: 'lotus', fruit: 'amphora' };

const isProp = (id: string): id is PropId => (PROP_IDS as readonly string[]).includes(id);

export class IslandStage extends ChapterStage {
  readonly scene: Scene;
  readonly world: IslandWorld;
  readonly player: Player;
  readonly cam: FollowCamera;
  readonly fx: Effects;
  /** 미니게임 등에서 카메라를 잠시 고정 */
  cinematic: { pos: Vector3; look: Vector3 } | null = null;
  private npcs = new Map<string, Npc>();
  private enemies: Enemy[] = [];
  private pendingGroups = new Map<string, () => void>();
  private pickups: Pickup[] = [];
  private flags: { pos: Vector3; obj: Group; on: boolean; ring?: Mesh }[] = [];
  private lids: { lid: Object3D; target: number }[] = [];
  private gateObjs = new Map<string, { obj: Group; open: boolean; barrier: Collider[] }>();
  private interactables: Interactable[] = [];
  private minigameSpot: Interactable | null = null;
  private zonesInside = new Set<string>();
  private checkpoint = new Vector3();
  private busy = false;
  private respawning = false;
  private beacon: Group;
  private beaconArrow: Mesh;
  /** 예고 공격 (보스·버티기) */
  readonly hazards: Hazards;
  private boss: BossFight | null = null;
  private bossId: BossId | null = null;
  private bossArena: BossArena | null = null;
  private bossCollider: Collider | null = null;
  private survive: { left: number; total: number; text: string; spawn: number; shown: number } | null = null;
  private shake = 0;

  constructor(chapter: ChapterData, layout: IslandLayout, svc: Services) {
    super(chapter, layout, svc);
    this.world = new IslandWorld(layout, chapter.memory ? 'memory' : 'day');
    this.scene = this.world.scene;
    this.fx = new Effects(this.scene);
    this.cam = new FollowCamera(this.camera);
    this.hazards = new Hazards(this.scene, (x, z) => this.world.ground(x, z), (h) => {
      const style = IMPACT_STYLE[h.effect];
      const y = this.world.ground(h.x, h.z);
      this.fx.burst(new Vector3(h.x, y + 0.5, h.z), style.color, 16, 4, 3);
      this.svc.audio.sfx(style.sfx, { volume: 0.7 });
      this.shake = Math.max(this.shake, style.shake);
      if (Math.hypot(this.player.pos.x - h.x, this.player.pos.z - h.z) <= h.r + 0.2) this.player.damage(1, new Vector3(h.x, y, h.z));
    });

    const save = svc.save.data;
    this.player = new Player(save?.avatar ?? DEFAULT_AVATAR, svc.audio);
    this.scene.add(this.player.root);
    const [sx, sz] = layout.spawn;
    const heading = Math.atan2(-sx, -sz);
    this.player.place(sx, this.world.ground(sx, sz), sz, heading);
    this.checkpoint.copy(this.player.pos);
    this.player.onDamaged = (hp) => {
      svc.ui.hud.setHearts(hp, this.player.maxHp);
      svc.ui.hud.flashHurt();
    };
    this.cam.snap(this.focus(), heading);

    this.buildNpcs();
    this.buildGates();
    this.buildShrines();
    this.buildChests();
    this.buildCheckpoints();
    this.buildPickups();
    this.buildEnemies();

    const beam = new Mesh(new CylinderGeometry(0.5, 0.5, 40, 12, 1, true), new MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.18, depthWrite: false }));
    beam.position.y = 20;
    this.beaconArrow = new Mesh(new ConeGeometry(0.55, 1.1, 4), new MeshBasicMaterial({ color: '#ffcc00' }));
    this.beaconArrow.rotation.x = Math.PI;
    this.beacon = new Group();
    this.beacon.add(beam, this.beaconArrow);
    this.beacon.visible = false;
    this.scene.add(this.beacon);

    svc.ui.hud.setHearts(this.player.hp, this.player.maxHp);
    svc.ui.hud.setCoins(save?.coins ?? 0);
    svc.ui.hud.onPromptClick = () => this.tryInteract();
    svc.ui.touch.set('explore');
  }

  override begin() {
    super.begin();
    const hint = this.svc.input.touchMode
      ? '왼쪽을 끌어 움직이고, ⚔️ 버튼으로 칼을 휘둘러요!'
      : 'WASD 이동 · Space 점프 · J 공격 · Shift 구르기 · E 말하기';
    this.svc.ui.hud.toast(hint, 4500);
  }

  focus() {
    return this.player.pos.clone().setY(this.player.pos.y + 1.6);
  }

  // ─── 만들기 ───────────────────────────────────────────────

  private buildNpcs() {
    for (const n of this.layout.npcs) {
      const pos = new Vector3(n.pos[0], this.world.ground(n.pos[0], n.pos[1]), n.pos[1]);
      const npc = new Npc(n.id, n.model, pos, n.rotY ?? 0);
      this.scene.add(npc.root);
      this.npcs.set(n.id, npc);
      this.world.addCollider(n.pos[0], n.pos[1], 0.5, `npc:${n.id}`);
      this.interactables.push({
        pos,
        range: 3.6,
        label: () => '💬 이야기하기',
        act: () => this.talk(n.id),
      });
    }
  }

  private buildGates() {
    for (const g of this.layout.gates) {
      if (g.chapter !== this.chapter.id) continue;
      const slot = this.chapter.quizSlots.find((s) => s.id === g.quizSlot);
      const obj = buildGate();
      const y = this.world.ground(g.pos[0], g.pos[1]);
      obj.position.set(g.pos[0], y, g.pos[1]);
      obj.rotation.y = g.rotY;
      this.scene.add(obj);
      const barrier: Collider[] = [];
      for (const c of gateColliders(g.pos, g.rotY)) {
        const col = this.world.addCollider(c.x, c.z, c.r, c.barrier ? 'gateBarrier' : 'gatePillar');
        if (c.barrier) barrier.push(col);
      }
      const state = { obj, open: false, barrier };
      this.gateObjs.set(g.id, state);
      this.interactables.push({
        pos: new Vector3(g.pos[0], y, g.pos[1]),
        range: 3.6,
        label: () => (state.open ? null : '🦉 지혜의 문 열기'),
        act: async () => {
          if (slot) await this.askSlot(slot.id);
          this.openGate(g.id);
          if (slot) this.runner.emit({ type: 'quiz', slot: slot.id });
        },
      });
    }
  }

  private openGate(id: string) {
    const st = this.gateObjs.get(id);
    if (!st || st.open) return;
    st.open = true;
    st.barrier.forEach((c) => (c.active = false));
    st.obj.traverse((o) => {
      if (o.name === 'barrier') o.visible = false;
    });
    this.svc.audio.sfx('gate_unlock');
    this.fx.burst(st.obj.position.clone().setY(st.obj.position.y + 2), '#7fd3ff', 30, 5, 3);
    this.svc.ui.hud.toast('🚪 지혜의 문이 열렸어요!');
  }

  private buildShrines() {
    const save = this.svc.save.data;
    for (const s of this.layout.shrines) {
      const key = `${this.layout.id}:${s.id}`;
      let done = save?.shrines.includes(key) ?? false;
      const obj = this.world.placeProp('owlShrine', s.pos, 0, 1, this.scene);
      let glow = obj.getObjectByName('glow');
      if (!glow) {
        // 모델에 빛나는 고리가 없으면 엔진이 붙인다 (아직 안 푼 신전 표시)
        glow = glowRing(1.1, '#ffe066');
        glow.position.copy(obj.position).setY(obj.position.y + 0.03);
        this.scene.add(glow);
      }
      if (done) glow.visible = false;
      this.interactables.push({
        pos: obj.position.clone(),
        range: 2.8,
        label: () => (done ? null : '🦉 부엉이 신전 (보너스 문제)'),
        act: async () => {
          this.block();
          try {
            const r = await this.svc.learning.ask({ reason: 'shrine' });
            this.asked += r.questionIds.length;
            this.firstTry += r.firstTry;
          } finally {
            this.unblock();
          }
          done = true;
          if (glow) glow.visible = false;
          this.svc.save.data?.shrines.push(key);
          this.svc.addCoins(3);
          this.fx.burst(obj.position.clone().setY(obj.position.y + 2), '#ffe066', 24, 5, 4);
          this.fx.floatText(obj.position.clone().setY(obj.position.y + 2.6), '+3 🫒');
          this.svc.audio.sfx('owl');
        },
      });
    }
  }

  private buildChests() {
    const save = this.svc.save.data;
    for (const c of this.layout.chests) {
      const key = `${this.layout.id}:${c.id}`;
      let opened = save?.opened.includes(key) ?? false;
      const obj = this.world.placeProp('chest', c.pos, Math.atan2(-c.pos[0], -c.pos[1]), 1, this.scene);
      const lid = obj.getObjectByName('lid');
      if (lid && opened) lid.rotation.x = -1.9;
      this.interactables.push({
        pos: obj.position.clone(),
        range: 2.4,
        label: () => (opened ? null : '🎁 보물상자 열기'),
        act: async () => {
          opened = true;
          if (lid) this.lids.push({ lid, target: -1.9 });
          this.svc.save.data?.opened.push(key);
          this.svc.addCoins(c.coins);
          this.svc.audio.sfx('chest_open');
          this.fx.burst(obj.position.clone().setY(obj.position.y + 1), '#f6c343', 22, 4, 5);
          this.fx.floatText(obj.position.clone().setY(obj.position.y + 1.8), `+${c.coins} 🫒`);
        },
      });
    }
  }

  private buildCheckpoints() {
    for (const c of this.layout.checkpoints) {
      const obj = this.world.placeProp('checkpointFlag', c.pos, 0, 1, this.scene);
      this.flags.push({ pos: obj.position.clone(), obj, on: false });
    }
  }

  private buildPickups() {
    for (const c of this.layout.collectibles) {
      const id = ITEM_MODEL[c.item] ?? (isProp(c.item) ? c.item : 'coin');
      const obj = isProp(id) ? makeProp(id) : getModel(id);
      const y = this.world.ground(c.pos[0], c.pos[1]);
      obj.position.set(c.pos[0], y + 0.3, c.pos[1]);
      const ring = new Mesh(new CylinderGeometry(0.9, 0.9, 0.04, 20), new MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.45, depthWrite: false }));
      ring.position.set(c.pos[0], y + 0.03, c.pos[1]);
      ring.name = 'ring';
      obj.userData.ring = ring;
      this.scene.add(obj, ring);
      this.pickups.push({ item: c.item, obj, pos: new Vector3(c.pos[0], y, c.pos[1]), taken: false, phase: Math.random() * 6 });
    }
  }

  private buildEnemies() {
    for (const e of this.layout.enemies) {
      // 이 장의 '물리치기' 목표가 부르는 무리만, 그 목표가 켜질 때 나타난다.
      // (같은 섬을 쓰는 다른 장 — 예: 이타카 13·15장, 궁전 17장 잔치 — 에는 나오지 않는다)
      if (!this.chapter.objectives.some((o) => o.type === 'defeat' && o.target === e.id)) continue;
      this.pendingGroups.set(e.id, () => this.spawnEnemies(e.id, e.model, e.pos, e.count, e.spread));
    }
  }

  private spawnEnemies(group: string, model: ModelId, at: XZ, count: number, spread: number) {
    const base = ENEMY_SPECS[model] ?? { model, hp: 3, speed: 3, damage: 1, aggro: 10, windup: 0.8 };
    const spec: EnemySpec = { ...base, ...(GROUP_SPECS[group] ?? {}), model };
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x = at[0] + Math.cos(a) * spread * 0.6;
      const z = at[1] + Math.sin(a) * spread * 0.6;
      if (!this.world.terrain.isLand(x, z)) continue;
      const enemy = new Enemy(group, { ...spec, variant: i % 4 }, new Vector3(x, this.world.ground(x, z), z), this.svc.audio);
      enemy.onDefeated = (en) => {
        this.svc.addCoins(1);
        this.fx.floatText(en.pos.clone().setY(en.pos.y + 2), '+1 🫒');
        this.runner.emit({ type: 'defeat', group });
      };
      this.scene.add(enemy.root);
      this.enemies.push(enemy);
      this.fx.burst(new Vector3(x, this.world.ground(x, z) + 1, z), spec.shadow ? '#8f7bff' : '#ffffff', 14, 3, 3);
    }
  }

  // ─── 목표 ─────────────────────────────────────────────────

  protected setupObjective(o: Objective | null) {
    for (const [id, npc] of this.npcs) npc.setQuest(o?.type === 'talk' && o.target === id);
    if (this.minigameSpot) {
      this.interactables = this.interactables.filter((i) => i !== this.minigameSpot);
      this.minigameSpot = null;
    }
    if (!o) return;
    if (o.type === 'defeat' && o.target) {
      const spawn = this.pendingGroups.get(o.target);
      if (spawn) {
        this.pendingGroups.delete(o.target);
        spawn();
        this.svc.audio.sfx('magic');
      }
    }
    if (o.type === 'boss' && o.target && (BOSS_IDS as readonly string[]).includes(o.target)) this.prepareBoss(o.target as BossId);
    if (o.type === 'survive') {
      const total = o.timeLimitSec ?? 30;
      this.survive = { left: total, total, text: o.text, spawn: 1, shown: -1 };
      this.svc.ui.hud.toast('🛡️ 떨어지는 바위를 피해 버텨요! 빨간 원을 보면 비켜요');
    }
    if (o.type === 'minigame' && o.target && (MINIGAME_IDS as readonly string[]).includes(o.target)) {
      const id = o.target as MinigameId;
      const zone = this.layout.zones.find((z) => z.id === id);
      if (zone) {
        const pos = new Vector3(zone.center[0], this.world.ground(zone.center[0], zone.center[1]), zone.center[1]);
        this.minigameSpot = {
          pos,
          range: Math.max(3, zone.radius),
          label: () => MINIGAME_LABEL[id],
          act: () => this.playMinigame(id, pos),
        };
        this.interactables.push(this.minigameSpot);
      } else {
        queueMicrotask(() => void this.playMinigame(id, this.player.pos.clone()));
      }
    }
  }

  async playMinigame(id: MinigameId, at: Vector3) {
    const fn = ISLAND_MINIGAMES[id];
    if (fn) await fn(this, at);
    else await this.playSteps([{ type: 'line', speaker: 'athenaOwl', text: '이 놀이는 아직 준비 중이야. 다음으로 가자!' }]);
    this.runner.emit({ type: 'minigame', id });
  }

  private async talk(id: string) {
    const npc = this.npcs.get(id);
    if (npc) npc.talking = true;
    this.runner.emit({ type: 'talk', npc: id });
    await this.runner.idle();
    if (npc) npc.talking = false;
  }

  /** 길잡이 빛을 세울 곳 */
  private beaconTarget(): Vector3 | null {
    const o = this.runner.objective;
    if (!o || !o.target) return null;
    switch (o.type) {
      case 'talk':
        return this.npcs.get(o.target)?.pos ?? null;
      case 'reach':
      case 'minigame': {
        const z = this.layout.zones.find((x) => x.id === o.target);
        return z ? new Vector3(z.center[0], this.world.ground(z.center[0], z.center[1]), z.center[1]) : null;
      }
      case 'collect':
      case 'rescue': {
        let best: Pickup | null = null;
        let bestD = Infinity;
        for (const p of this.pickups) {
          if (p.taken || p.item !== o.target) continue;
          const d = p.pos.distanceToSquared(this.player.pos);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
        if (best) {
          // 닫힌 지혜의 문 너머라면 문을 가리킨다
          for (const [, g] of this.gateObjs) {
            if (g.open) continue;
            const gp = g.obj.position;
            if (best.pos.distanceTo(gp) < 12 && this.player.pos.distanceTo(gp) > best.pos.distanceTo(gp) && this.player.pos.distanceTo(best.pos) > 6) {
              const behind = this.layout.zones.some((z) => Math.hypot(z.center[0] - best!.pos.x, z.center[1] - best!.pos.z) < z.radius && Math.hypot(z.center[0] - this.player.pos.x, z.center[1] - this.player.pos.z) > z.radius + 2 && Math.hypot(z.center[0] - gp.x, z.center[1] - gp.z) < z.radius + 4);
              if (behind) return gp;
            }
          }
        }
        return best?.pos ?? null;
      }
      case 'defeat': {
        const e = this.enemies.find((x) => x.alive && x.group === o.target);
        return e?.pos ?? null;
      }
      case 'quiz': {
        const g = this.layout.gates.find((x) => x.quizSlot === o.target && x.chapter === this.chapter.id);
        return g ? new Vector3(g.pos[0], this.world.ground(g.pos[0], g.pos[1]), g.pos[1]) : null;
      }
      case 'boss': {
        const a = this.bossArena;
        return a && !this.boss ? new Vector3(a.x, this.world.ground(a.x, a.z), a.z) : null;
      }
      default:
        return null;
    }
  }

  // ─── 보스전 ───────────────────────────────────────────────

  /** 보스 목표가 켜지면 무대를 정해 두고, 플레이어가 무대에 들어서면 시작 */
  private prepareBoss(id: BossId) {
    const b = this.layout.boss;
    this.bossId = id;
    this.bossArena = b && b.id === id
      ? { x: b.arenaCenter[0], z: b.arenaCenter[1], radius: b.arenaRadius }
      : { x: this.player.pos.x, z: this.player.pos.z, radius: 10 };
  }

  private startBoss() {
    const id = this.bossId;
    const arena = this.bossArena;
    if (!id || !arena) return;
    const bossSlots = this.chapter.quizSlots.filter((s) => s.placement === 'boss');
    let quizIdx = 0;
    const host: BossHost = {
      scene: this.scene,
      hazards: this.hazards,
      ground: (x, z) => this.world.ground(x, z),
      playerPos: () => this.player.pos,
      sfx: (s) => this.svc.audio.sfx(s),
      shake: (s) => (this.shake = Math.max(this.shake, s)),
      burst: (at, color, n) => this.fx.burst(at, color, n, 6, 4),
      toast: (t) => this.svc.ui.hud.toast(t),
      summon: (model, count, near) => {
        const alive = this.enemies.filter((e) => e.alive && e.group === 'boss-minions').length;
        const n = Math.min(count, 4 - alive);
        if (n > 0) this.spawnEnemies('boss-minions', model, [near.x + 2.5, near.z + 2.5], n, 3);
      },
      // 장의 boss 퀴즈 자리를 차례로 (16장은 다섯 과목을 돌아가며)
      askWeak: () => this.ask(bossSlots.length ? bossSlots[quizIdx++ % bossSlots.length] : undefined, 'boss'),
      bar: (name, hp, max) => this.svc.ui.hud.setBoss(name, hp, max),
      phase: (name) => this.runner.emit({ type: 'bossPhase', phase: name }),
      defeated: () => {
        if (this.bossCollider) this.bossCollider.active = false;
        this.svc.addCoins(5);
        this.fx.floatText(this.player.pos.clone().setY(this.player.pos.y + 2.4), '+5 🫒');
        this.svc.audio.playBgm(this.chapter.bgm.explore);
        this.bossId = null;
        this.runner.emit({ type: 'boss', id });
      },
    };
    this.boss = new BossFight(bossFactory(id), arena, host);
    this.scene.add(this.boss.root);
    this.bossCollider = this.world.addCollider(this.boss.pos.x, this.boss.pos.z, this.boss.radius * 0.7, 'boss');
    this.svc.audio.playBgm(this.chapter.bgm.boss ?? 'boss');
    this.svc.ui.hud.toast(`⚔️ ${this.boss.def.name}!`);
    this.boss.start();
  }

  /** '버티기' 목표 — 시간이 다 될 때까지 떨어지는 바위를 피한다 */
  private updateSurvive(dt: number) {
    const s = this.survive;
    if (!s) return;
    s.left -= dt;
    s.spawn -= dt;
    const sec = Math.max(0, Math.ceil(s.left));
    if (sec !== s.shown) {
      s.shown = sec;
      this.svc.ui.hud.setObjective(`${s.text} ⏱ ${sec}초`);
    }
    if (s.spawn <= 0 && s.left > 1.5) {
      const k = 1 - s.left / s.total;
      s.spawn = 1.5 - 0.6 * k;
      const n = k > 0.5 && Math.random() < 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = i === 0 ? Math.random() * 1.5 : 2 + Math.random() * 3;
        this.hazards.add(this.player.pos.x + Math.cos(a) * d, this.player.pos.z + Math.sin(a) * d, 1.6, 1.3, 'rock');
      }
    }
    if (s.left <= 0) {
      this.survive = null;
      this.hazards.clear();
      this.svc.ui.hud.toast('🛡️ 잘 버텼어요!');
      this.runner.emit({ type: 'survived' });
    }
  }

  // ─── 매 프레임 ────────────────────────────────────────────

  update(dt: number, input: InputFrame) {
    this.time += dt;
    const frozen = this.isBlocked || this.respawning;
    this.player.frozen = frozen;
    const targets: Hittable[] = this.boss?.alive ? [...this.enemies, this.boss] : this.enemies;
    this.player.update(dt, input, this.cam, this.world, targets, this.fx);
    for (const e of this.enemies) e.update(dt, this.player, this.world, this.enemies, this.fx, frozen);
    this.enemies = this.enemies.filter((e) => e.alive || e.root.parent);
    for (const npc of this.npcs.values()) npc.update(dt, this.player.pos);

    // 보스전·예고 공격·버티기
    if (this.bossId && !this.boss && !frozen && this.bossArena) {
      const a = this.bossArena;
      if (Math.hypot(this.player.pos.x - a.x, this.player.pos.z - a.z) < a.radius + 2) this.startBoss();
    }
    if (this.boss) {
      this.boss.update(dt, frozen);
      if (this.boss.alive && this.bossCollider) {
        this.bossCollider.x = this.boss.pos.x;
        this.bossCollider.z = this.boss.pos.z;
      }
      if (!this.boss.alive && !this.boss.root.parent) this.boss = null;
    }
    if (!frozen) {
      this.hazards.update(dt);
      this.updateSurvive(dt);
    }

    // 줍기
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.phase += dt;
      p.obj.position.y = p.pos.y + 0.35 + Math.sin(p.phase * 2.5) * 0.15;
      p.obj.rotation.y += dt * 1.2;
      if (!frozen && p.pos.distanceTo(this.player.pos) < 1.5) {
        p.taken = true;
        p.obj.removeFromParent();
        (p.obj.userData.ring as Object3D | undefined)?.removeFromParent();
        this.inv.set(p.item, (this.inv.get(p.item) ?? 0) + 1);
        this.svc.audio.sfx('pickup');
        this.fx.burst(p.pos.clone().setY(p.pos.y + 0.8), '#ffe066', 16, 3, 3);
        this.runner.emit({ type: 'pickup', item: p.item });
      }
    }

    // 체크포인트
    for (const f of this.flags) {
      if (f.on || frozen || f.pos.distanceTo(this.player.pos) > 2.4) continue;
      for (const other of this.flags) other.on = other === f;
      f.on = true;
      this.checkpoint.copy(f.pos);
      const flag = f.obj.getObjectByName('flag');
      if (flag instanceof Mesh) flag.material = new MeshToonMaterial({ color: '#f6c343' });
      // 어떤 모델이든 '켜진 체크포인트'를 알 수 있게 금빛 고리를 둘러 준다
      if (!f.ring) {
        f.ring = glowRing(1.3, '#f6c343');
        f.ring.position.copy(f.pos).setY(f.pos.y + 0.04);
        this.scene.add(f.ring);
      }
      for (const other of this.flags) if (other.ring) other.ring.visible = other === f;
      this.svc.audio.sfx('checkpoint');
      this.svc.ui.hud.toast('🚩 여기서 다시 시작할 수 있어요');
      this.player.heal();
      this.svc.ui.hud.setHearts(this.player.hp, this.player.maxHp);
    }

    // 구역 들어가기
    if (!frozen) {
      for (const z of this.layout.zones) {
        const inside = Math.hypot(this.player.pos.x - z.center[0], this.player.pos.z - z.center[1]) < z.radius;
        if (inside && !this.zonesInside.has(z.id)) {
          this.zonesInside.add(z.id);
          this.runner.emit({ type: 'zone', zone: z.id });
        } else if (!inside) this.zonesInside.delete(z.id);
      }
    }

    // 상호작용
    if (!frozen && !this.busy) {
      const best = this.nearestInteractable();
      const lbl = best?.label() ?? null;
      this.svc.ui.hud.setPrompt(lbl, this.svc.input.touchMode ? '✋' : 'E');
      this.svc.ui.touch.setInteract(lbl);
      if (input.interact && best) void this.runInteract(best);
    }

    for (const l of this.lids) l.lid.rotation.x += (l.target - l.lid.rotation.x) * Math.min(1, dt * 6);

    // 길잡이 빛
    const target = frozen ? null : this.beaconTarget();
    this.beacon.visible = !!target;
    if (target) {
      this.beacon.position.set(target.x, target.y, target.z);
      this.beaconArrow.position.y = 4.2 + Math.sin(this.time * 4) * 0.3;
      this.beaconArrow.rotation.y += dt * 2;
    }

    // 쓰러지면 체크포인트에서 다시
    if (this.player.hp <= 0 && !this.respawning) void this.respawn();

    this.world.update(this.time, this.player.pos);
    if (this.cinematic) {
      this.camera.position.lerp(this.cinematic.pos, 1 - Math.exp(-dt * 3));
      this.camera.lookAt(this.cinematic.look);
    } else {
      const moving = Math.abs(input.moveX) + Math.abs(input.moveY) > 0.1 && !frozen;
      this.cam.update(dt, this.focus(), frozen ? null : input, moving ? this.player.heading : null, (x, z) => this.world.ground(x, z));
    }
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.8;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.8;
      this.shake = Math.max(0, this.shake - dt * 1.6);
    }
    this.fx.update(dt);
  }

  private nearestInteractable(): Interactable | null {
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.interactables) {
      if (!it.label()) continue;
      const d = Math.hypot(it.pos.x - this.player.pos.x, it.pos.z - this.player.pos.z);
      if (d < it.range && d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }

  private tryInteract() {
    if (this.isBlocked || this.busy) return;
    const best = this.nearestInteractable();
    if (best) void this.runInteract(best);
  }

  private async runInteract(it: Interactable) {
    this.busy = true;
    this.svc.ui.hud.setPrompt(null);
    try {
      await it.act();
    } finally {
      this.busy = false;
    }
  }

  private async respawn() {
    this.respawning = true;
    this.block();
    this.hazards.clear();
    await this.svc.ui.screens.fade(true, 350);
    this.player.place(this.checkpoint.x, this.checkpoint.y, this.checkpoint.z);
    this.player.heal();
    this.player.invuln = 2;
    this.svc.ui.hud.setHearts(this.player.hp, this.player.maxHp);
    this.cam.snap(this.focus());
    await this.svc.ui.screens.fade(false, 350);
    this.unblock();
    this.respawning = false;
    this.svc.ui.hud.toast('다시 해 보자! 💪');
  }

  override dispose() {
    super.dispose();
    for (const npc of this.npcs.values()) npc.dispose();
    this.boss?.dispose();
    this.hazards.clear();
    this.svc.ui.hud.setBoss(null);
    this.fx.dispose();
    this.scene.traverse((o) => {
      const el = (o as { element?: HTMLElement }).element;
      if (el instanceof HTMLElement) el.remove();
    });
  }
}
