/**
 * 게임 전체 흐름 — 타이틀 → (학년 고르기) → 장 시작 카드 → 장 플레이 → 장 완료 → 다음 장 … → 엔딩.
 * 바다 지도에서는 끝낸 장을 언제든 다시 할 수 있다.
 * 렌더 루프 하나에서 지금 장면(Stage)을 그린다.
 */
import { DirectionalLight, Mesh, type MeshStandardMaterial, PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { CHAPTER_IDS, type BgmId, type ChapterData, type ChapterId, type Grade, type IslandLayout } from '../types/contracts';
import type { InputFrame } from '../core/input';
import { createAudio } from '../audio';
import { Input } from '../core/input';
import { lowerQuality, qualityLevel, qualityTier } from '../core/quality';
import { chapters, islands, shopItems } from '../content';
import { LearningEngine } from '../learning/engine';
import { CHILD_STORY } from '../story/childStory';
import { CHAPTER_EMOJI, CREDITS } from '../story/credits';
import { DialogueUI } from '../ui/dialogue';
import { creditsRoll, reportCard, storybook } from '../ui/ending';
import { Hud } from '../ui/hud';
import { openHub, type HubIslandView } from '../ui/hub';
import { QuizUI } from '../ui/quiz';
import { Screens } from '../ui/screens';
import { TouchControls } from '../ui/touch';
import { waterMaterial } from '../world/environment';
import { disposeScene } from '../world/merge';
import { openWardrobe, WARDROBE_READY } from '../ui/wardrobe';
import { createSaveStore, emptyProgress } from './save';
import { buy } from './shop';
import type { ChapterResult, ChapterStage } from './chapterStage';
import { EndingStage } from './endingStage';
import { HubStage, type HubIsland } from './hubStage';
import { IslandStage } from './islandStage';
import { parentReport } from './parentReport';
import { applyPrefs } from './prefs';
import {
  advanceFrontier, chapterState, islandFinds, islandRoute, islandState, subjectScores, totalFinds,
} from './progress';
import { SeaStage } from './seaStage';
import { TitleStage } from './titleStage';
import type { Services, Stage } from './services';

export class Game {
  private renderer: WebGLRenderer;
  private labels: CSS2DRenderer;
  private svc: Services;
  private stage: Stage | null = null;
  private chapterStage: ChapterStage | null = null;
  private paused = false;
  /** 완료 화면에서는 마지막 장면을 그리기만 하고 전투·이동은 멈춘다. */
  private stageComplete = false;
  private last = performance.now();
  private closeTitle: (() => void) | null = null;
  private tempProgress = emptyProgress();
  private currentBgm: BgmId = 'title';
  /** 이번에 켠 뒤로 장을 논 시간(초) — 보호자 놀이 시간 알림용 */
  private sessionPlay = 0;
  private restNotified = false;
  /** 실제로 느리면 화질을 한 단계씩 낮춘다 */
  private perf = { warm: 0, time: 0, frames: 0, low: 0 };
  private frameNo = 0;
  /** 멈춤·장 완료 화면에서는 3D 를 다시 그리지 않는다 (배터리 절약) — 크기가 바뀌면 한 번 그린다 */
  private redraw = true;

  constructor(canvas: HTMLCanvasElement, private uiRoot: HTMLElement, labelsRoot: HTMLElement) {
    applyPrefs();
    // 가장 낮은 화질에서는 계단 현상 제거(안티앨리어싱)도 끈다
    this.renderer = new WebGLRenderer({ canvas, antialias: qualityLevel() > 0, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualityTier().ratio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.labels = new CSS2DRenderer({ element: labelsRoot });

    const input = new Input(canvas);
    const audio = createAudio();
    const save = createSaveStore();
    save.load();
    const quiz = new QuizUI(uiRoot, {
      correct: () => audio.sfx('correct'),
      wrong: () => audio.sfx('wrong'),
      click: () => audio.sfx('ui_click'),
    });
    const dialogue = new DialogueUI(uiRoot, () => audio.sfx('ui_open', { volume: 0.35 }));
    const hud = new Hud(uiRoot);
    const screens = new Screens(uiRoot);
    const touch = new TouchControls(uiRoot, input);
    const learning = new LearningEngine({
      getGrade: () => save.data?.grade ?? 1,
      progress: () => save.data?.learning ?? this.tempProgress,
      onChange: () => save.touch(),
      presenter: quiz,
      onAnswered: (_q, firstTry) => this.svc.addCoins(firstTry ? 2 : 1),
    });
    this.svc = {
      audio,
      input,
      save,
      learning,
      ui: { root: uiRoot, dialogue, quiz, hud, screens, touch },
      addCoins: (n) => {
        if (save.data) {
          save.data.coins += n;
          save.touch();
        }
        hud.setCoins(save.data?.coins ?? 0, n > 0);
        if (n > 0) audio.sfx('coin', { volume: 0.6 });
      },
    };
    hud.onPause = () => void this.openPause();
    this.applyVolumes();

    // 브라우저는 터치라면 '손을 뗄 때', 마우스·키보드라면 '누를 때'에만 소리를 허락한다.
    // 그래서 소리가 켜질 때까지 사용자가 무언가 할 때마다 다시 시도한다.
    let firstGesture = true;
    const unlock = () => {
      audio.unlock();
      if (!firstGesture) return;
      firstGesture = false;
      this.applyVolumes();
      audio.playBgm(this.currentBgm);
    };
    for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
      window.addEventListener(type, unlock, { capture: true, passive: true });
    }
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        save.flush();
        if (this.chapterStage) void this.openPause();
      }
    });
    window.addEventListener('pagehide', () => save.flush());
    this.resize();
    requestAnimationFrame(this.loop);
  }

  start() {
    this.showTitle();
  }

  // ─── 루프 ─────────────────────────────────────────────────

  private loop = (now: number) => {
    const raw = Math.max(0, (now - this.last) / 1000);
    const dt = Math.min(0.05, raw);
    this.last = now;
    this.step(dt, this.svc.input.frame());
    this.watchPerformance(raw);
    if (this.stage && (this.redraw || !(this.paused || this.stageComplete))) {
      this.redraw = false;
      this.prepareShadows();
      this.renderer.render(this.stage.scene, this.stage.camera);
      this.labels.render(this.stage.scene, this.stage.camera);
    }
    requestAnimationFrame(this.loop);
  };

  /** 한 프레임 진행 — 실제 루프와 개발용 debugStep 이 같이 쓴다 */
  private step(dt: number, input: InputFrame) {
    if (input.pause && this.chapterStage && !this.paused) void this.openPause();
    if (!this.stage || this.paused || this.stageComplete) return;
    this.stage.update(dt, input);
    if (this.chapterStage) this.countPlay(dt);
  }

  private countPlay(dt: number) {
    const data = this.svc.save.data;
    if (data) data.playSeconds += dt;
    this.sessionPlay += dt;
    const limit = data?.settings.timeLimit ?? 0;
    if (limit > 0 && !this.restNotified && this.sessionPlay >= limit * 60) {
      this.restNotified = true;
      this.svc.audio.sfx('hint');
      this.svc.ui.hud.toast(`⏰ ${limit}분 동안 모험했어요! 이 장을 마치면 쉬어요`, 6000);
    }
  }

  private restDue(): boolean {
    const limit = this.svc.save.data?.settings.timeLimit ?? 0;
    return limit > 0 && this.sessionPlay >= limit * 60;
  }

  /** 화질에 따라 그림자를 몇 프레임에 한 번만 다시 그린다 */
  private prepareShadows() {
    const every = qualityTier().shadowEvery;
    this.renderer.shadowMap.autoUpdate = every === 1;
    if (every > 1 && this.frameNo++ % every === 0) this.renderer.shadowMap.needsUpdate = true;
  }

  /** 지금 화질 단계를 렌더러와 지금 장면에 적용한다 */
  private applyQuality() {
    const t = qualityTier();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, t.ratio));
    this.renderer.shadowMap.needsUpdate = true;
    this.stage?.scene.traverse((o) => {
      if (o instanceof DirectionalLight) {
        o.castShadow = t.shadowMap > 0;
        if (t.shadowMap > 0 && o.shadow.mapSize.x !== t.shadowMap) {
          o.shadow.mapSize.set(t.shadowMap, t.shadowMap);
          o.shadow.map?.dispose();
          o.shadow.map = null;
        }
      } else if (o instanceof Mesh && o.userData.water && t.simpleWater && (o.material as MeshStandardMaterial).isMeshStandardMaterial) {
        const old = o.material as MeshStandardMaterial;
        o.material = waterMaterial(old.color, true);
        old.dispose();
      }
    });
    this.resize();
  }

  /**
   * 장을 하는 동안 4초씩 재서 두 번 잇달아 초당 40프레임이 안 되면 화질을 한 단계 낮춘다.
   * 장 시작 3초는 그림 준비(셰이더)로 잠깐 느릴 수 있어 재지 않는다.
   */
  private watchPerformance(raw: number) {
    const p = this.perf;
    if (qualityLevel() === 0 || !this.chapterStage || this.paused || raw <= 0 || raw > 0.25) return;
    if (p.warm < 3) {
      p.warm += raw;
      return;
    }
    p.time += raw;
    p.frames++;
    if (p.time < 4) return;
    const fps = p.frames / p.time;
    p.time = 0;
    p.frames = 0;
    p.low = fps < 40 ? p.low + 1 : 0;
    if (p.low >= 2 && lowerQuality(fps < 25)) {
      p.low = 0;
      p.warm = 0;
      this.applyQuality();
    }
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.labels.setSize(w, h);
    this.stage?.resize(w, h);
    this.redraw = true;
  }

  private setStage(s: Stage | null) {
    if (this.stage) {
      this.stage.dispose();
      disposeScene(this.stage.scene);
    }
    this.stage = s;
    this.stageComplete = false;
    Object.assign(this.perf, { warm: 0, time: 0, frames: 0, low: 0 });
    this.resize();
  }

  private playBgm(id: BgmId) {
    this.currentBgm = id;
    this.svc.audio.playBgm(id, { fadeMs: 800 });
  }

  private applyVolumes() {
    const s = this.svc.save.data?.settings ?? { master: 0.9, sfx: 0.8, bgm: 0.6 };
    this.svc.audio.setVolume('master', s.master);
    this.svc.audio.setVolume('sfx', s.sfx);
    this.svc.audio.setVolume('bgm', s.bgm);
  }

  /** 장면을 떠날 때 남은 대화·퀴즈·미니게임 화면 정리 */
  private clearOverlays() {
    this.svc.ui.dialogue.abortAll();
    this.svc.ui.quiz.abortAll();
    this.uiRoot.querySelectorAll('.mini-panel, .screen.titlecard').forEach((el) => el.remove());
    this.svc.ui.hud.show(false);
    this.svc.ui.hud.setExtra(null);
    this.svc.ui.touch.set('none');
    this.svc.input.enabled = true;
  }

  // ─── 화면 흐름 ────────────────────────────────────────────

  private showTitle() {
    this.chapterStage = null;
    this.paused = false;
    this.clearOverlays();
    this.setStage(new TitleStage(this.svc.save.data?.avatar));
    this.playBgm('title');
    const data = this.svc.save.data;
    const no = data ? CHAPTER_IDS.indexOf(data.chapter) + 1 : 0;
    const allDone = !!data && data.completed.length === CHAPTER_IDS.length;
    const label = data ? (allDone ? '지도에서 골라요' : `${no}장부터`) : null;
    this.closeTitle?.();
    this.closeTitle = this.svc.ui.screens.title({
      continueLabel: label,
      build: `v1 · ${__BUILD_SHA__}`,
      onStart: () => void this.newGame(),
      onContinue: () => void this.continueGame(),
      onSettings: () => void this.openSettings(),
      onMap: data && !allDone ? () => void this.showMap() : undefined,
      onWardrobe: data && WARDROBE_READY ? () => void this.openWardrobe() : undefined,
    });
  }

  /** 꾸미기 — 올리브잎으로 사고, 입으면 타이틀의 오디세우스가 바로 바뀐다 */
  private async openWardrobe() {
    const data = this.svc.save.data;
    if (!data) return;
    const title = this.stage instanceof TitleStage ? this.stage : null;
    const root = this.svc.ui.root;
    const shown = openWardrobe(root, {
      items: shopItems,
      coins: data.coins,
      owned: [...data.owned],
      avatar: { ...data.avatar },
      onBuy: (item) => {
        const r = buy(item, data.coins, data.owned);
        if (!r.ok) return null;
        data.coins = r.coins;
        data.owned = r.owned;
        this.svc.save.touch();
        return data.coins;
      },
      onWear: (avatar) => {
        data.avatar = { ...avatar };
        this.svc.save.touch();
        title?.setAvatar(data.avatar);
      },
      sfx: (id) => this.svc.audio.sfx(id),
    });
    // 미리보기: 꾸미기 카드 위쪽 빈 곳에 오디세우스를 크게 (카드 높이는 화면 크기마다 다르니 매 프레임 잰다)
    title?.setCloseUp(() => {
      const card = root.querySelector('.wardrobe-card');
      return card ? card.getBoundingClientRect().top / Math.max(1, window.innerHeight) : 1;
    });
    try {
      await shown;
    } finally {
      title?.setCloseUp(null);
    }
    this.svc.save.flush();
  }

  private async newGame() {
    const { save, ui } = this.svc;
    if (save.data && !(await ui.screens.confirm('처음부터 시작할까요? 지금까지의 기록은 지워져요.', '처음부터', '취소'))) return;
    const grade = await ui.screens.gradeSelect();
    if (!grade) return;
    save.create(grade);
    this.applyVolumes();
    this.closeTitle?.();
    this.closeTitle = null;
    await this.playFrom('ch01');
  }

  private async continueGame() {
    const data = this.svc.save.data;
    if (!data) return;
    if (data.completed.length === CHAPTER_IDS.length) {
      await this.showMap();
      return;
    }
    this.closeTitle?.();
    this.closeTitle = null;
    await this.playFrom(data.chapter);
  }

  private async playFrom(start: ChapterId) {
    let id: ChapterId | null = start;
    while (id) {
      const ch: ChapterData | undefined = chapters[id];
      const isl: IslandLayout | undefined = ch ? islands[ch.island] : undefined;
      if (!ch || !isl) {
        this.setStage(new TitleStage(this.svc.save.data?.avatar));
        await this.svc.ui.screens.comingSoon(CHAPTER_IDS.indexOf(id) + 1, ch?.title);
        this.showTitle();
        return;
      }
      const stage = await this.playChapter(ch, isl);
      const result = await stage.result;
      this.chapterStage = null;
      if (result === 'quit') {
        this.showTitle();
        return;
      }
      this.stageComplete = true;
      const next: ChapterId | null = CHAPTER_IDS[CHAPTER_IDS.indexOf(id) + 1] ?? null;
      const data = this.svc.save.data;
      if (data) {
        if (!data.completed.includes(id)) data.completed.push(id);
        // 지도에서 앞 장을 다시 해도 '다음에 할 장'은 뒤로 가지 않는다
        data.chapter = advanceFrontier(data.chapter, id);
      }
      this.svc.addCoins(ch.reward.coins);
      this.svc.save.flush();
      this.svc.ui.hud.show(false);
      this.svc.ui.touch.set('none');
      this.svc.audio.sfx('victory');
      const choice = await this.svc.ui.screens.chapterComplete({
        no: ch.no,
        title: ch.title,
        coins: ch.reward.coins,
        correct: stage.firstTry,
        total: stage.asked,
        hasNext: !!next,
        nextLabel: next ? undefined : '🎬 엔딩 보기',
        rest: this.restDue(),
      });
      if (choice === 'title') {
        this.showTitle();
        return;
      }
      if (choice === 'map') {
        await this.showMap(id);
        return;
      }
      if (!next) {
        await this.finale();
        return;
      }
      id = next;
    }
    this.showTitle();
  }

  // ─── 바다 지도 ────────────────────────────────────────────

  private async showMap(focus?: ChapterId) {
    const data = this.svc.save.data;
    if (!data) {
      this.showTitle();
      return;
    }
    this.chapterStage = null;
    this.paused = false;
    this.clearOverlays();
    this.closeTitle?.();
    this.closeTitle = null;

    const route = islandRoute(chapters);
    const hubIslands: HubIsland[] = [];
    const views: HubIslandView[] = [];
    for (const islandId of route) {
      const layout = islands[islandId];
      if (!layout) continue;
      const chs = CHAPTER_IDS.map((c) => chapters[c]).filter((c): c is ChapterData => !!c && c.island === islandId);
      const states = chs.map((c) => chapterState(data, c.id));
      const state = islandState(states);
      const memory = chs.some((c) => c.memory);
      hubIslands.push({ layout, chapters: chs, state, memory });
      views.push({
        id: islandId,
        name: layout.name,
        memory,
        state,
        chapters: chs.map((c, i) => ({ id: c.id, no: c.no, title: c.title, childText: c.titleCard.childText, state: states[i] })),
        finds: islandFinds(data, layout),
      });
    }
    const start = chapters[focus ?? data.chapter]?.island ?? route[0];
    const hub = new HubStage(hubIslands, start);
    this.setStage(hub);
    let memoryMusic = views.find((v) => v.id === start)?.memory ?? false;
    this.playBgm(memoryMusic ? 'memorySea' : 'sailing');
    const choice = await openHub(this.svc.ui.root, {
      islands: views,
      start,
      done: data.completed.length,
      total: CHAPTER_IDS.length,
      endingUnlocked: data.completed.includes('ch17'),
      onSelect: (id) => {
        hub.select(id);
        const memory = views.find((v) => v.id === id)?.memory ?? false;
        if (memory !== memoryMusic) {
          memoryMusic = memory;
          this.playBgm(memory ? 'memorySea' : 'sailing');
        }
      },
      pick: (x, y) => hub.pick(x, y),
      canvas: this.renderer.domElement,
      sfx: (sfxId) => this.svc.audio.sfx(sfxId, { volume: 0.5 }),
    });
    if (choice.type === 'play') await this.playFrom(choice.id);
    else if (choice.type === 'ending') await this.finale();
    else this.showTitle();
  }

  // ─── 엔딩 ─────────────────────────────────────────────────

  /** 엔딩(이야기책·크레딧) → 성적표 → 지도나 처음 화면 */
  private async finale() {
    await this.playEnding();
    const data = this.svc.save.data;
    const choice = data
      ? await reportCard(this.svc.ui.root, {
          playSeconds: data.playSeconds,
          coins: data.coins,
          chapters: data.completed.length,
          totalChapters: CHAPTER_IDS.length,
          subjects: subjectScores(data),
          finds: totalFinds(data, Object.values(islands).filter((l): l is IslandLayout => !!l)),
        })
      : 'title';
    if (choice === 'map') await this.showMap('ch17');
    else this.showTitle();
  }

  private async playEnding() {
    const { ui, audio } = this.svc;
    this.chapterStage = null;
    this.paused = false;
    this.clearOverlays();
    await ui.screens.fade(true, 500);
    this.setStage(new EndingStage(this.svc.save.data?.avatar));
    this.playBgm('ending');
    await ui.screens.fade(false, 700);
    const fast = ui.dialogue.fast;
    const pages = CHAPTER_IDS.map((id, i) => ({
      no: i + 1,
      title: chapters[id]?.title ?? '',
      text: CHILD_STORY[id],
      emoji: CHAPTER_EMOJI[id],
    }));
    await storybook(ui.root, pages, { pageMs: fast ? 300 : 4800, onPage: () => audio.sfx('ui_click', { volume: 0.35 }) });
    await creditsRoll(ui.root, CREDITS, { ms: fast ? 1200 : 28000 });
  }

  private async playChapter(ch: ChapterData, isl: IslandLayout): Promise<ChapterStage> {
    const { ui } = this.svc;
    this.clearOverlays();
    await ui.screens.fade(true, 300);
    const stage: ChapterStage = isl.kind === 'seaCourse' ? new SeaStage(ch, isl, this.svc) : new IslandStage(ch, isl, this.svc);
    this.chapterStage = stage;
    this.setStage(stage);
    this.playBgm(ch.bgm.explore);
    await ui.screens.fade(false, 300);
    await ui.dialogue.titleCard(ch);
    stage.begin();
    return stage;
  }

  // ─── 멈춤·설정 ────────────────────────────────────────────

  private async openPause() {
    const stage = this.chapterStage;
    if (this.paused || !stage) return;
    this.paused = true;
    this.svc.audio.sfx('ui_open');
    await this.svc.ui.screens.settings({
      grade: this.svc.save.data?.grade ?? null,
      volumes: this.svc.save.data?.settings ?? { master: 0.9, sfx: 0.8, bgm: 0.6 },
      onVolume: (ch, v) => this.setVolume(ch, v),
      onGrade: (g) => this.setGrade(g),
      extra: [{ label: '🏠 처음 화면으로', onClick: () => stage.quit() }],
      parent: this.parentOption(),
    });
    this.paused = false;
  }

  private async openSettings() {
    await this.svc.ui.screens.settings({
      grade: this.svc.save.data?.grade ?? null,
      volumes: this.svc.save.data?.settings ?? { master: 0.9, sfx: 0.8, bgm: 0.6 },
      onVolume: (ch, v) => this.setVolume(ch, v),
      onGrade: (g) => this.setGrade(g),
      resumeLabel: '닫기',
      parent: this.parentOption(),
    });
  }

  /** 보호자 모드 — 저장 기록이 있을 때만 */
  private parentOption() {
    const data = this.svc.save.data;
    if (!data) return undefined;
    return {
      report: () => parentReport(data, this.sessionPlay),
      onTimeLimit: (min: number) => {
        data.settings.timeLimit = min;
        this.restNotified = false;
        this.svc.save.touch();
      },
    };
  }

  private setVolume(ch: 'master' | 'sfx' | 'bgm', v: number) {
    this.svc.audio.setVolume(ch, v);
    const data = this.svc.save.data;
    if (data) {
      data.settings[ch] = v;
      this.svc.save.touch();
    }
  }

  private setGrade(g: Grade) {
    const data = this.svc.save.data;
    if (!data) return;
    data.grade = g;
    this.svc.save.touch();
  }

  // ─── 개발용 지름길 (npm run dev 에서만 main.ts 가 부른다) ─────────

  get debug(): { stage: Stage | null; result?: Promise<ChapterResult> } {
    return { stage: this.stage, result: this.chapterStage?.result };
  }

  debugFast(on: boolean) {
    this.svc.ui.dialogue.fast = on;
  }

  /**
   * 게임 시간을 직접 진행 (브라우저 창이 가려져 requestAnimationFrame 이 멈춘 상태에서도 시험할 수 있게).
   * 프레임 사이에 비동기 작업(대사·퀴즈)이 돌 수 있도록 매 프레임 잠깐 양보한다.
   */
  async debugStep(seconds: number, dt = 1 / 30) {
    const frames = Math.max(1, Math.round(seconds / dt));
    for (let i = 0; i < frames; i++) {
      this.step(dt, this.svc.input.frame());
      await new Promise((r) => setTimeout(r, 0));
    }
    if (this.stage) {
      this.prepareShadows();
      this.renderer.render(this.stage.scene, this.stage.camera);
      this.labels.render(this.stage.scene, this.stage.camera);
    }
  }

  async debugPlay(id: ChapterId) {
    if (!this.svc.save.data) this.svc.save.create(2);
    this.closeTitle?.();
    this.closeTitle = null;
    await this.playFrom(id);
  }

  /** 개발용: 바다 지도(?map=1) · 엔딩(?ending=1) 바로 보기 */
  async debugShow(what: 'map' | 'ending') {
    if (!this.svc.save.data) this.svc.save.create(2);
    this.closeTitle?.();
    this.closeTitle = null;
    if (what === 'map') await this.showMap();
    else await this.finale();
  }
}
