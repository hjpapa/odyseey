/**
 * [Codex A3] 효과음 프리셋 — SFX_IDS 전부 채우기.
 * 값은 ZzFX 파라미터 배열 (https://killedbyapixel.github.io/ZzFX/ 에서 만들고 복사).
 */
import type { SfxId } from '../types/contracts';

export type ZzfxParams = (number | undefined)[];

// volume, randomness, frequency, attack, sustain, release, shape, curve,
// slide, deltaSlide, jump, jumpTime, repeat, noise. All voices are instrumental.
const tone = (volume: number, hz: number, release: number, slide = 0, shape = 0): ZzfxParams =>
  [volume, 0, hz, .004, .025, release, shape, 1, slide];
const noise = (volume: number, hz: number, release: number, slide = 0): ZzfxParams =>
  [volume, .08, hz, .004, .008, release, 4, 1, slide, 0, 0, 0, 0, .7];
const chime = (volume: number, hz: number, jump: number, release = .18): ZzfxParams =>
  [volume, 0, hz, .006, .04, release, 0, 1, 0, 0, jump, .06];

export const sfxPresets: Record<SfxId, ZzfxParams> = {
  step_sand: noise(.07, 100, .035), step_grass: noise(.06, 180, .03),
  step_stone: tone(.09, 160, .025, -2, 1), step_wood: tone(.08, 240, .04, -1, 1),
  jump: tone(.19, 250, .12, 3), land: tone(.12, 100, .07, -2),
  roll: noise(.10, 140, .10), swim: noise(.08, 230, .09, 1),
  sword_swing: noise(.14, 450, .09, -3), sword_hit: chime(.19, 380, 180, .10),
  shield_block: chime(.20, 300, -80, .12), bow_draw: tone(.09, 180, .18, 1, 1),
  bow_release: tone(.13, 620, .10, -3), arrow_hit: tone(.14, 220, .08, -1, 1),
  player_hurt: tone(.13, 300, .14, -1), enemy_hurt: tone(.12, 220, .11, -1),
  enemy_defeat: chime(.18, 520, 260, .20), boss_roar: tone(.17, 140, .40, .15, 1),
  boss_hit: tone(.19, 180, .18, -.5, 1), boss_defeat: chime(.24, 440, 220, .60),
  coin: chime(.20, 880, 440, .15), pickup: chime(.16, 660, 220, .17),
  heal: chime(.18, 528, 264, .35), chest_open: chime(.19, 330, 330, .40),
  door_open: tone(.11, 150, .30, .3, 1), gate_unlock: chime(.21, 440, 220, .38),
  checkpoint: chime(.18, 587, 293, .30), splash: noise(.12, 300, .16, -1),
  wave: noise(.06, 150, .38), thunder: noise(.14, 65, .45, -.1),
  wind: noise(.045, 320, .40, .2), whirlpool: tone(.09, 180, .36, -.2, 1),
  magic: chime(.17, 740, 370, .35), sheep: tone(.10, 370, .17, -.35, 1),
  pig: tone(.10, 220, .12, .25, 1), owl: chime(.11, 420, -100, .22),
  sail: noise(.07, 220, .17), rope: tone(.08, 180, .06, 1, 1),
  correct: chime(.23, 659, 329, .22), wrong: tone(.12, 330, .19, -.35),
  hint: chime(.13, 587, 146, .25), combo: chime(.20, 784, 392, .22),
  ui_click: tone(.10, 700, .025), ui_open: tone(.12, 440, .07, 1),
  ui_close: tone(.10, 550, .07, -1), level_up: chime(.22, 523, 523, .40),
  victory: chime(.24, 659, 659, .60),
};
