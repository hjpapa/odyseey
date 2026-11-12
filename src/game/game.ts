/**
 * 게임 전체 흐름 — 타이틀 → (학년 고르기) → 장 시작 카드 → 장 플레이 → 장 완료 → 다음 장.
 * 렌더 루프 하나에서 지금 장면(Stage)을 그린다.
 */
import { PCFSoftShadowMap, SRGBColorSpace, WebGLRenderer } from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { CHAPTER_IDS, type ChapterData, type ChapterId, type Grade, type IslandLayout } from '../types/contracts';
import { createAudio } from '../audio';
import { Input } from '../core/input';
import { chapters, islands } from '../content';
import { LearningEngine } from '../learning/engine';
import { DialogueUI } from '../ui/dialogue';
import { Hud } from '../ui/hud';
import { QuizUI } from '../ui/quiz';
import { Screens } from '../ui/screens';
import { TouchControls } from '../ui/touch';
import { createSaveStore, emptyProgress } from './save';
import type { ChapterResult, ChapterStage } from './chapterStage';
import { IslandStage } from './islandStage';
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
  private last = performance.now();
  private closeTitle: (() => void) | null = null;
  private tempProgress = emptyProgress();
  private currentBgm: Parameters<Services['audio']['playBgm']>[0] = 'title';

  constructor(canvas: HTMLCanvasElement, private uiRoot: HTMLElement, labelsRoot: HTMLElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

    const unlock = () => {
      if (audio.unlocked) return;
      audio.unlock();
      this.applyVolumes();
      audio.playBgm(this.currentBgm);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
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
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const input = this.svc.input.frame();
    if (input.pause && this.chapterStage && !this.paused) void this.openPause();
    if (this.stage && !this.paused) {
      this.stage.update(dt, input);
      if (this.chapterStage && this.svc.save.data) this.svc.save.data.playSeconds += dt;
    }
    if (this.stage) {
      this.renderer.render(this.stage.scene, this.stage.camera);
      this.labels.render(this.stage.scene, this.stage.camera);
    }
    requestAnimationFrame(this.loop);
  };

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.labels.setSize(w, h);
    this.stage?.resize(w, h);
  }

  private setStage(s: Stage | null) {
    this.stage?.dispose();
    this.stage = s;
    this.resize();
  }

  private playBgm(id: typeof this.currentBgm) {
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
    const label = data ? (data.completed.length === CHAPTER_IDS.length ? '다시 모험' : `${no}장부터`) : null;
    this.closeTitle?.();
    this.closeTitle = this.svc.ui.screens.title({
      continueLabel: label,
      build: `P1 · ${__BUILD_SHA__}`,
      onStart: () => void this.newGame(),
      onContinue: () => void this.continueGame(),
      onSettings: () => void this.openSettings(),
    });
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
      const next: ChapterId | null = CHAPTER_IDS[CHAPTER_IDS.indexOf(id) + 1] ?? null;
      const data = this.svc.save.data;
      if (data) {
        if (!data.completed.includes(id)) data.completed.push(id);
        data.chapter = next ?? id;
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
      });
      if (choice === 'title') {
        this.showTitle();
        return;
      }
      id = next;
    }
    this.showTitle();
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
    });
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
      const input = this.svc.input.frame();
      if (this.stage && !this.paused) this.stage.update(dt, input);
      await new Promise((r) => setTimeout(r, 0));
    }
    if (this.stage) {
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
}
