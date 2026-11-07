/** 게임 전체가 함께 쓰는 것들 */
import type { PerspectiveCamera, Scene } from 'three';
import type { AudioApi } from '../types/contracts';
import type { Input, InputFrame } from '../core/input';
import type { LearningEngine } from '../learning/engine';
import type { DialogueUI } from '../ui/dialogue';
import type { Hud } from '../ui/hud';
import type { QuizUI } from '../ui/quiz';
import type { Screens } from '../ui/screens';
import type { TouchControls } from '../ui/touch';
import type { SaveStore } from './save';

export interface Services {
  audio: AudioApi;
  input: Input;
  save: SaveStore;
  learning: LearningEngine;
  ui: {
    root: HTMLElement;
    dialogue: DialogueUI;
    quiz: QuizUI;
    hud: Hud;
    screens: Screens;
    touch: TouchControls;
  };
  /** 코인 더하기 (저장·HUD 갱신) */
  addCoins(n: number): void;
}

export interface Stage {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  update(dt: number, input: InputFrame): void;
  resize(w: number, h: number): void;
  dispose(): void;
}
