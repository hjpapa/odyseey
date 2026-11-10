/** 대화창에 보일 인물 이름·아이콘·색 */
import type { SpeakerId } from '../types/contracts';

export interface SpeakerInfo {
  name: string;
  icon: string;
  color: string;
}

export const SPEAKERS: Record<SpeakerId, SpeakerInfo> = {
  narrator: { name: '이야기', icon: '📜', color: '#8d6e63' },
  odysseus: { name: '오디세우스', icon: '🧔', color: '#3b6fd8' },
  crewman: { name: '부하', icon: '👨', color: '#5d7a99' },
  telemachus: { name: '텔레마코스', icon: '🧑', color: '#2e8b57' },
  athena: { name: '아테나', icon: '🛡️', color: '#6a5acd' },
  athenaOwl: { name: '부엉이 아테', icon: '🦉', color: '#8b6b3d' },
  hermes: { name: '헤르메스', icon: '💌', color: '#2a9df4' },
  calypso: { name: '칼립소', icon: '🌺', color: '#d6457a' },
  ino: { name: '바다 요정 이노', icon: '🧜‍♀️', color: '#16a5a5' },
  aeolus: { name: '아이올로스', icon: '🌬️', color: '#4a90b8' },
  circe: { name: '키르케', icon: '🧙‍♀️', color: '#8e44ad' },
  tiresias: { name: '테이레시아스', icon: '🧓', color: '#5c6b7a' },
  nausicaa: { name: '나우시카', icon: '👸', color: '#e67e22' },
  alcinous: { name: '알키노오스 왕', icon: '🤴', color: '#b8860b' },
  penelope: { name: '페넬로페', icon: '👩', color: '#c0392b' },
  eumaeus: { name: '에우마이오스', icon: '👴', color: '#7b5e3b' },
  poseidon: { name: '포세이돈', icon: '🔱', color: '#1565c0' },
  helios: { name: '헬리오스', icon: '☀️', color: '#e6a100' },
  polyphemus: { name: '폴리페모스(폴리페오스)', icon: '👁️', color: '#7d5a50' },
  lotusEater: { name: '연꽃 먹는 사람', icon: '🪷', color: '#d36ba6' },
  lotusKing: { name: '연꽃 대장', icon: '🪷', color: '#b0417f' },
  laestrygonian: { name: '거인', icon: '🗿', color: '#6d6d6d' },
  laestrygonianKing: { name: '거인 왕', icon: '👑', color: '#5b4636' },
  siren: { name: '세이렌', icon: '🎶', color: '#9b59b6' },
  sirenQueen: { name: '세이렌 여왕', icon: '🎼', color: '#7d3c98' },
  greekSoldier: { name: '병사', icon: '💂', color: '#8b3a3a' },
  soldierCaptain: { name: '병사 대장', icon: '⚔️', color: '#7a1f1f' },
  suitor: { name: '구혼자', icon: '🤵', color: '#5d4e6d' },
  antinous: { name: '안티노오스', icon: '😠', color: '#4a235a' },
  dog: { name: '아르고스', icon: '🐕', color: '#a0522d' },
};
