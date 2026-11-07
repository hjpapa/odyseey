/** 섬에서 하는 미니게임 모음. 아직 없는 것은 '준비 중' 안내 후 통과 */
import type { Vector3 } from 'three';
import type { MinigameId } from '../../types/contracts';
import type { IslandStage } from '../../game/islandStage';
import { raftBuild } from './raftBuild';

export type IslandMinigame = (stage: IslandStage, at: Vector3) => Promise<void>;

export const ISLAND_MINIGAMES: Partial<Record<MinigameId, IslandMinigame>> = {
  raftBuild,
};

export const MINIGAME_LABEL: Record<MinigameId, string> = {
  raftBuild: '🪵 뗏목 만들기',
  waveRunner: '🌊 폭풍 뚫기',
  sheepEscape: '🐑 양 밑에 숨기',
  windSail: '⛵ 바람 타기',
  nightWatch: '🕒 불침번 서기',
  lightningDodge: '⚡ 벼락 피하기',
  whirlpoolSteer: '🌀 소용돌이 피하기',
  rhythmShield: '🎶 노래 막기',
  ballGame: '⚽ 공놀이',
  hideWeapons: '🗡️ 무기 숨기기',
  bowString: '🏹 활시위 걸기',
  axeArchery: '🎯 도끼 꿰뚫기',
  feast: '🍇 잔치',
};
