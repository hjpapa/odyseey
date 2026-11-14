/**
 * 엔딩에 쓰는 글 — 이야기책 장면 그림(이모지)과 크레딧.
 * 이름을 넣거나 고치고 싶으면 이 파일만 바꾸면 된다.
 */
import type { ChapterId } from '../types/contracts';

/** 이야기책 한 장마다 크게 보여 줄 그림 */
export const CHAPTER_EMOJI: Record<ChapterId, string> = {
  ch01: '🏝️',
  ch02: '🌊',
  ch03: '👁️',
  ch04: '🪷',
  ch05: '🌬️',
  ch06: '🪨',
  ch07: '🐷',
  ch08: '👻',
  ch09: '⚡',
  ch10: '🌀',
  ch11: '🎶',
  ch12: '⚽',
  ch13: '🏠',
  ch14: '🛡️',
  ch15: '👦',
  ch16: '🏹',
  ch17: '💖',
};

export interface CreditLine {
  /** 작은 제목 (예: '이야기') — 없으면 큰 글씨 한 줄 */
  role?: string;
  text: string;
}

export const CREDITS: CreditLine[] = [
  { text: '🏛️ 오디세이 — 집으로 가는 길' },
  { role: '🖋️ 이야기', text: '17장의 이야기를 쓴 꼬마 작가님' },
  { role: '📜 원작', text: '호메로스 『오디세이아』' },
  { role: '⛵ 주인공', text: '오디세우스' },
  { role: '🏠 기다린 가족', text: '페넬로페 · 텔레마코스 · 충성스러운 개' },
  { role: '🦉 도와준 친구들', text: '아테나 부엉이 · 헤르메스 · 칼립소 · 아이올로스 · 나우시카' },
  { role: '⚔️ 맞선 상대들', text: '폴리페모스 · 연꽃 대장 · 거인 왕 · 키르케 · 헬리오스 · 스킬라 · 세이렌 여왕 · 병사 대장 · 안티노오스' },
  { role: '🧱 블록 세상', text: 'Three.js 로 코드에서 쌓았어요' },
  { role: '🎵 소리', text: 'ZzFX 효과음 · 직접 지은 배경음' },
  { role: '🤖 함께 만든 도우미', text: 'Claude · Codex' },
  { text: '그리고 끝까지 모험한 바로 너! 🎉' },
];
