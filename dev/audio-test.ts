/** 개발용 사운드 테스트 — http://localhost:5173/dev/audio-test.html */
import { createAudio } from '../src/audio';
import { sfxPresets } from '../src/audio/sfx';
import { bgmTracks } from '../src/audio/tracks';
import { BGM_IDS, SFX_IDS } from '../src/types/contracts';

const audio = createAudio();
const $ = (id: string) => document.getElementById(id)!;

function button(label: string, missing: boolean, onClick: () => void) {
  const b = document.createElement('button');
  b.textContent = label;
  if (missing) b.classList.add('missing');
  b.addEventListener('click', () => {
    audio.unlock();
    onClick();
  });
  return b;
}

for (const id of SFX_IDS) $('sfx').append(button(id, !sfxPresets[id], () => audio.sfx(id)));
$('sfx-count').textContent = `(${SFX_IDS.filter((id) => sfxPresets[id]).length}/${SFX_IDS.length})`;

for (const id of BGM_IDS) {
  const t = bgmTracks[id];
  $('bgm').append(button(t ? `▶ ${id} — ${t.title}` : `▶ ${id}`, !t, () => audio.playBgm(id, { fadeMs: 600 })));
}
$('bgm').append(button('■ 정지', false, () => audio.stopBgm(600)));
$('bgm-count').textContent = `(${BGM_IDS.filter((id) => bgmTracks[id]).length}/${BGM_IDS.length})`;

for (const ch of ['master', 'sfx', 'bgm'] as const) {
  const input = $(`v-${ch}`) as HTMLInputElement;
  input.addEventListener('input', () => audio.setVolume(ch, Number(input.value)));
}
