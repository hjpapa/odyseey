import './style.css';
import { createAudio } from './audio';
import { startTitleScene } from './boot/titleScene';

const audio = createAudio();

const sha = document.getElementById('sha');
if (sha) sha.textContent = __BUILD_SHA__;

// 첫 입력 때 오디오를 깨우고 타이틀 음악 재생 (브라우저 자동재생 정책)
const unlockAudio = () => {
  if (audio.unlocked) return;
  audio.unlock();
  audio.playBgm('title');
};
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

const toast = document.getElementById('toast');
let toastTimer = 0;
document.getElementById('start')?.addEventListener('click', () => {
  unlockAudio();
  audio.sfx('ui_click');
  if (!toast) return;
  toast.textContent = '1장 「칼립소의 섬」은 다음 업데이트에서 열려요! ⛵';
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3200);
});

const canvas = document.getElementById('scene') as HTMLCanvasElement;
try {
  startTitleScene(canvas);
} catch (err) {
  console.error(err);
  const box = document.createElement('div');
  box.className = 'fallback';
  box.textContent = '이 기기에서는 3D 화면을 열 수 없어요. 다른 브라우저(크롬·사파리 최신 버전)로 열어 주세요.';
  document.body.appendChild(box);
}
