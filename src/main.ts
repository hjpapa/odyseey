import './style.css';
import { Game } from './game/game';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const labels = document.getElementById('labels') as HTMLElement;

try {
  const game = new Game(canvas, ui, labels);
  game.start();
  if (import.meta.env.DEV) {
    // 개발용: ?play=ch02 로 그 장 바로 시작, ?fast=1 로 대사 빨리 넘기기
    (window as unknown as { game: Game }).game = game;
    const params = new URLSearchParams(location.search);
    if (params.get('fast')) game.debugFast(true);
    const play = params.get('play');
    if (play && /^ch\d\d$/.test(play)) void game.debugPlay(play as Parameters<Game['debugPlay']>[0]);
  }
} catch (err) {
  console.error(err);
  const box = document.createElement('div');
  box.className = 'fallback';
  box.textContent = '이 기기에서는 3D 화면을 열 수 없어요. 다른 브라우저(크롬·사파리 최신 버전)로 열어 주세요.';
  document.body.appendChild(box);
}
