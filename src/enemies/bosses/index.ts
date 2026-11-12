/**
 * 보스 패턴 등록부.
 * Codex: 새 보스 파일(<id>.ts)을 만들면 아래 import 와 BOSSES 에 한 줄씩 추가한다.
 * 스킬라(10장)는 바다 위 보스라 엔진(src/game/seaStage.ts)이 직접 다룬다 — 여기 넣지 않는다.
 */
import type { BossFactory, BossId } from '../../types/contracts';
import { genericBoss, type GenericOptions } from './generic';
import polyphemus from './polyphemus';

export const BOSSES: Partial<Record<BossId, BossFactory>> = {
  polyphemus,
};

/** 전용 패턴이 없는 보스의 임시 설정 */
const FALLBACK: Record<BossId, GenericOptions> = {
  polyphemus: { name: '외눈 거인 폴리페모스' },
  lotusKing: { name: '연꽃 대장', effect: 'magic', greeting: '연꽃을 먹고 쉬어 가렴~' },
  laestrygonianKing: { name: '거인 왕', effect: 'rock', greeting: '내 항구에서 나가라!' },
  circe: { name: '마녀 키르케', effect: 'magic', greeting: '너도 돼지로 만들어 주마!' },
  helios: { name: '태양신 헬리오스', melee: false, lift: 6, effect: 'lightning', greeting: '내 소를 건드린 자는 누구냐!' },
  scylla: { name: '머리 여섯 스킬라', effect: 'splash' },
  sirenQueen: { name: '세이렌 여왕', effect: 'magic', greeting: '내 노래를 들어 보렴~' },
  soldierCaptain: { name: '병사 대장', effect: 'stomp', greeting: '여기는 못 지나간다!' },
  antinous: { name: '구혼자 대장 안티노오스', effect: 'stomp', greeting: '이 궁전은 이제 내 거야!' },
};

export function bossFactory(id: BossId): BossFactory {
  return BOSSES[id] ?? genericBoss(id, FALLBACK[id]);
}

/** 전용 패턴이 있는지 (테스트·개발용) */
export function hasDedicatedBoss(id: BossId): boolean {
  return typeof BOSSES[id] === 'function';
}
