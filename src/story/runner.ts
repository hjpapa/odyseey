/**
 * 챕터 진행기 — ChapterData 의 목표를 순서대로 켜고, 사건(대화·도착·줍기·물리치기…)이 오면
 * 목표를 완료하고 장면(대사·퀴즈)을 재생한다. 화면·3D 와는 RunnerHost 로만 이야기한다.
 * 사건은 줄을 세워 하나씩 처리한다 (대사 중에 생긴 사건도 잃어버리지 않게).
 */
import type { ChapterData, Objective, Scene, SceneStep } from '../types/contracts';

export type RunnerEvent =
  | { type: 'talk'; npc: string }
  | { type: 'zone'; zone: string }
  | { type: 'pickup'; item: string }
  | { type: 'defeat'; group: string }
  | { type: 'quiz'; slot: string }
  | { type: 'minigame'; id: string }
  | { type: 'boss'; id: string }
  | { type: 'bossPhase'; phase: string }
  | { type: 'survived' };

export interface RunnerHost {
  /** 대사·자막·퀴즈 단계를 재생 */
  playSteps(steps: SceneStep[]): Promise<void>;
  /** 목표가 바뀜 (null = 모두 끝) — HUD·적 등장·미니게임 시작 등 */
  onObjective(o: Objective | null, index: number): void;
  onProgress(o: Objective, have: number, need: number): void;
  onObjectiveDone(o: Objective): void;
  /** 지금까지 주운 아이템 수 */
  inventory(item: string): number;
  /** 퀴즈 자리 하나를 묻는다 */
  askSlot(slotId: string): Promise<void>;
  /** 지금 할 일과 상관없는 말 걸기 */
  idleTalk(npc: string, objective: Objective | null): Promise<void>;
}

export class ChapterRunner {
  index = -1;
  finished = false;
  progress = 0;
  private played = new Set<string>();
  private queue: Promise<void> = Promise.resolve();
  private resolveDone!: () => void;
  /** 장 끝 장면까지 모두 끝나면 풀린다 */
  readonly done: Promise<void> = new Promise((r) => (this.resolveDone = r));

  constructor(readonly chapter: ChapterData, private host: RunnerHost) {}

  get objective(): Objective | null {
    return this.chapter.objectives[this.index] ?? null;
  }

  start(): void {
    this.enqueue(async () => {
      await this.playWhere((s) => s.trigger.on === 'chapterStart');
      await this.activate(0);
    });
  }

  emit(e: RunnerEvent): void {
    this.enqueue(() => this.handle(e));
  }

  /** 대사 재생 중인지 등과 무관하게 지금 처리할 일이 남았는지 */
  idle(): Promise<void> {
    return this.queue;
  }

  private enqueue(fn: () => Promise<void>) {
    this.queue = this.queue.then(fn).catch((err) => console.error('[runner]', err));
  }

  private async handle(e: RunnerEvent) {
    if (this.finished) return;
    const o = this.objective;
    switch (e.type) {
      case 'zone':
        await this.playWhere((s) => s.trigger.on === 'enterZone' && s.trigger.zone === e.zone, true);
        if (o?.type === 'reach' && o.target === e.zone) await this.complete();
        return;
      case 'talk': {
        const talkScenes = this.chapter.scenes.filter((s) => s.trigger.on === 'talk' && s.trigger.npc === e.npc);
        const tied = this.chapter.objectives.some((x) => x.type === 'talk' && x.target === e.npc);
        if (o?.type === 'talk' && o.target === e.npc) {
          const scene = talkScenes.find((s) => !this.played.has(s.id)) ?? talkScenes[talkScenes.length - 1];
          if (scene) await this.play(scene);
          await this.complete();
          return;
        }
        const free = !tied ? talkScenes.find((s) => !this.played.has(s.id)) : undefined;
        if (free) await this.play(free);
        else await this.host.idleTalk(e.npc, o);
        return;
      }
      case 'pickup':
        if ((o?.type === 'collect' || o?.type === 'rescue') && o.target === e.item) await this.checkCollect(o);
        return;
      case 'defeat':
        if (o?.type === 'defeat' && o.target === e.group) {
          this.progress++;
          const need = o.count ?? 1;
          this.host.onProgress(o, this.progress, need);
          if (this.progress >= need) await this.complete();
        }
        return;
      case 'quiz':
        if (o?.type === 'quiz' && o.target === e.slot) await this.complete();
        return;
      case 'minigame':
        if (o?.type === 'minigame' && o.target === e.id) await this.complete();
        return;
      case 'boss':
        if (o?.type === 'boss' && o.target === e.id) await this.complete();
        return;
      case 'bossPhase':
        await this.playWhere((s) => s.trigger.on === 'bossPhase' && s.trigger.phase === e.phase, true);
        return;
      case 'survived':
        if (o?.type === 'survive') await this.complete();
        return;
    }
  }

  private async activate(i: number) {
    this.index = i;
    this.progress = 0;
    const o = this.objective;
    if (!o) {
      await this.finish();
      return;
    }
    this.host.onObjective(o, i);
    if (o.type === 'collect' || o.type === 'rescue') await this.checkCollect(o);
    else if (o.type === 'quiz') {
      const slot = this.chapter.quizSlots.find((s) => s.id === o.target);
      // 지혜의 문은 문 앞에서, 그 밖의 퀴즈 목표는 바로 묻는다
      if (!slot || slot.placement !== 'gate') {
        if (slot) await this.host.askSlot(slot.id);
        await this.complete();
      }
    }
  }

  private async checkCollect(o: Objective) {
    const need = o.count ?? 1;
    const have = Math.min(need, this.host.inventory(o.target ?? ''));
    this.host.onProgress(o, have, need);
    if (have >= need && this.objective === o) await this.complete();
  }

  private async complete() {
    const o = this.objective;
    if (!o) return;
    this.host.onObjectiveDone(o);
    await this.playWhere((s) => s.trigger.on === 'objectiveDone' && s.trigger.objective === o.id);
    await this.activate(this.index + 1);
  }

  private async finish() {
    if (this.finished) return;
    this.finished = true;
    this.host.onObjective(null, -1);
    await this.playWhere((s) => s.trigger.on === 'chapterEnd');
    this.resolveDone();
  }

  private async playWhere(pred: (s: Scene) => boolean, once = false) {
    for (const s of this.chapter.scenes.filter(pred)) {
      if (once && this.played.has(s.id)) continue;
      await this.play(s);
    }
  }

  private async play(s: Scene) {
    this.played.add(s.id);
    await this.host.playSteps(s.steps);
  }
}
