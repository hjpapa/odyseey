/**
 * 챕터 장면의 공통 부분 — 진행기(ChapterRunner)와 대화·퀴즈·HUD 를 잇는다.
 * 섬(IslandStage)과 바다 코스(SeaStage)가 이것을 물려받는다.
 */
import { PerspectiveCamera, type Scene } from 'three';
import type { ChapterData, IslandLayout, Objective, QuizPlacement, QuizSlot, SceneStep, SpeakerId } from '../types/contracts';
import type { InputFrame } from '../core/input';
import { SPEAKERS } from '../story/speakers';
import { ChapterRunner, type RunnerHost } from '../story/runner';
import { sleep } from '../ui/dom';
import type { Services, Stage } from './services';

const IDLE_LINES = ['안녕! 모험은 잘 되어 가?', '힘내요, 오디세우스!', '아테의 말을 잘 들어 봐요.'];

export type ChapterResult = 'complete' | 'quit';

export abstract class ChapterStage implements Stage, RunnerHost {
  abstract readonly scene: Scene;
  readonly camera = new PerspectiveCamera(55, 1, 0.1, 1200);
  readonly runner: ChapterRunner;
  /** 대화·퀴즈 중이면 0 보다 큼 — 그동안 게임 진행을 멈춘다 */
  protected blocked = 0;
  protected inv = new Map<string, number>();
  protected time = 0;
  asked = 0;
  firstTry = 0;
  private finish!: (r: ChapterResult) => void;
  readonly result: Promise<ChapterResult> = new Promise((r) => (this.finish = r));
  private ended = false;
  private life = new AbortController();
  /** 장면을 떠나면 중단되는 신호 — 미니게임 리스너·비동기 동작 정리에 쓴다 */
  readonly signal = this.life.signal;

  constructor(readonly chapter: ChapterData, readonly layout: IslandLayout, readonly svc: Services) {
    this.runner = new ChapterRunner(chapter, this);
    void this.runner.done.then(() => this.end('complete'));
  }

  get isBlocked() {
    return this.blocked > 0;
  }

  /** 장 시작 (장 시작 카드가 닫힌 뒤) */
  begin() {
    this.svc.ui.hud.show(true);
    this.runner.start();
  }

  quit() {
    this.end('quit');
  }

  protected end(r: ChapterResult) {
    if (this.ended) return;
    this.ended = true;
    this.finish(r);
  }

  block() {
    this.blocked++;
    this.svc.input.enabled = false;
    this.svc.ui.hud.setPrompt(null);
    this.svc.ui.touch.setInteract(null);
  }

  unblock() {
    this.blocked = Math.max(0, this.blocked - 1);
    if (this.blocked === 0) this.svc.input.enabled = true;
  }

  abstract update(dt: number, input: InputFrame): void;

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 68 : 55;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.life.abort();
    this.svc.input.enabled = true;
  }

  /** 목표가 바뀔 때 장면별 준비 (적 등장, 미니게임 시작 …) */
  protected abstract setupObjective(o: Objective | null): void;

  // ─── RunnerHost ─────────────────────────────────────────────

  async playSteps(steps: SceneStep[]) {
    this.block();
    try {
      for (const s of steps) {
        if (this.ended) return;
        switch (s.type) {
          case 'line':
            await this.svc.ui.dialogue.line(s.speaker, s.text, s.emote);
            break;
          case 'caption':
            await this.svc.ui.dialogue.caption(s.text);
            break;
          case 'quiz':
            await this.askSlot(s.slot);
            break;
          case 'sfx':
            this.svc.audio.sfx(s.id);
            if (s.id === 'thunder') this.svc.ui.screens.flash();
            break;
          case 'wait':
            await sleep(this.svc.ui.dialogue.fast ? 10 : s.ms);
            break;
        }
      }
    } finally {
      this.unblock();
    }
  }

  async askSlot(slotId: string) {
    await this.ask(this.chapter.quizSlots.find((q) => q.id === slotId));
  }

  /**
   * 퀴즈 하나를 묻고 결과를 돌려준다. slot 이 없으면 그 장의 첫 학습 과목으로 즉석 출제.
   * @returns 모든 문제를 첫 시도에 맞혔는지
   */
  async ask(slot: QuizSlot | undefined, reason: QuizPlacement = slot?.placement ?? 'story'): Promise<boolean> {
    this.block();
    try {
      const r = slot
        ? await this.svc.learning.ask({ reason, slot })
        : await this.svc.learning.ask({ reason, subject: this.chapter.learning[0] });
      this.asked += r.questionIds.length;
      this.firstTry += r.firstTry;
      return r.firstTry === r.questionIds.length;
    } finally {
      this.unblock();
    }
  }

  onObjective(o: Objective | null) {
    this.svc.ui.hud.setObjective(o ? this.objectiveText(o) : null);
    this.setupObjective(o);
  }

  onProgress(o: Objective, have: number, need: number) {
    this.svc.ui.hud.setObjective(`${o.text} ${have}/${need}`);
  }

  onObjectiveDone(o: Objective) {
    this.svc.audio.sfx('level_up');
    this.svc.ui.hud.toast(`✅ ${o.text}`);
    this.svc.ui.hud.setObjective(o.text, true);
  }

  inventory(item: string) {
    return this.inv.get(item) ?? 0;
  }

  async idleTalk(npc: string, objective: Objective | null) {
    const model = this.layout.npcs.find((n) => n.id === npc)?.model;
    const speaker = (model && model in SPEAKERS ? model : 'narrator') as SpeakerId;
    const line = IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)];
    const steps: SceneStep[] = [{ type: 'line', speaker, text: line }];
    if (objective) steps.push({ type: 'line', speaker: 'athenaOwl', text: `지금 할 일: ${objective.text}` });
    await this.playSteps(steps);
  }

  protected objectiveText(o: Objective) {
    const need = o.count ?? 0;
    if (o.type === 'collect' || o.type === 'rescue') return `${o.text} ${Math.min(need, this.inventory(o.target ?? ''))}/${need}`;
    if (o.type === 'defeat') return `${o.text} 0/${need}`;
    return o.text;
  }
}
