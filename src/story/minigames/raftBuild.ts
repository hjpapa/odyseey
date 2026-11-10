/**
 * 1장 미니게임 — 모은 통나무를 하나씩 놓아 뗏목을 만들고 돛을 올린다.
 * 어떤 뗏목 모델이든: 낮은 부분(통나무)은 누를 때마다 차례로 나타나고, 높은 부분(돛대·돛)은 마지막에 솟아오른다.
 */
import { Vector3 } from 'three';
import { alignLengthToZ, makeProp, splitByHeight } from '../../world/props';
import type { IslandStage } from '../../game/islandStage';
import { h, sleep } from '../../ui/dom';

const PRESSES = 5;
const RISE = 2.5;

export async function raftBuild(stage: IslandStage, at: Vector3): Promise<void> {
  const { svc, world, fx } = stage;
  stage.block();
  const raft = makeProp('raft');
  alignLengthToZ(raft);
  const { low, tall } = splitByHeight(raft, 0.9);
  const y = world.ground(at.x, at.z);
  raft.position.set(at.x, y, at.z);
  raft.rotation.y += Math.atan2(at.x, at.z); // 긴 쪽이 바다를 향하게
  const progressive = low.length >= PRESSES;
  [...low, ...tall].forEach((m) => (m.visible = false));
  if (!progressive) raft.scale.setScalar(0.2);
  stage.scene.add(raft);

  // 오디세우스는 뗏목 옆에 서서 바라보고, 카메라는 비스듬히 위에서
  const inland = new Vector3(-at.x, 0, -at.z).normalize();
  const side = new Vector3(inland.z, 0, -inland.x);
  const stand = at.clone().addScaledVector(side, 3).addScaledVector(inland, 1.5);
  stage.player.place(stand.x, world.ground(stand.x, stand.z), stand.z, Math.atan2(at.x - stand.x, at.z - stand.z));
  const camPos = at.clone().addScaledVector(inland, 10).addScaledVector(side, -4);
  camPos.y = y + 8;
  stage.cinematic = { pos: camPos, look: at.clone().setY(y + 0.6) };

  const info = h('div', { class: 'info', text: `🪵 0 / ${PRESSES}` });
  const btn = h('button', { class: 'btn gold', type: 'button', text: '🪵 통나무 놓기' });
  const panel = h('div', { class: 'mini-panel' }, info, btn);
  svc.ui.root.append(panel);
  btn.focus();

  let placed = 0;
  await new Promise<void>((resolve) => {
    const press = () => {
      if (placed >= PRESSES) return;
      placed++;
      info.textContent = `🪵 ${placed} / ${PRESSES}`;
      svc.audio.sfx('pickup', { pitch: 0.9 + placed * 0.06 });
      if (progressive) {
        const show = Math.ceil((placed / PRESSES) * low.length);
        low.forEach((m, i) => (m.visible = i < show));
      } else raft.scale.setScalar(0.2 + (0.8 * placed) / PRESSES);
      fx.burst(at.clone().setY(y + 0.6), '#d7a86e', 10, 3, 2);
      if (placed >= PRESSES) {
        window.removeEventListener('keydown', onKey, true);
        resolve();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (['Space', 'Enter', 'KeyE', 'KeyJ'].includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        press();
      }
    };
    btn.addEventListener('click', press, { signal: stage.signal });
    window.addEventListener('keydown', onKey, { capture: true, signal: stage.signal });
  });

  btn.remove();
  low.forEach((m) => (m.visible = true));
  raft.scale.setScalar(1);
  info.textContent = '⛵ 돛을 올려요!';
  svc.audio.sfx('rope');
  await sleep(350);
  // 돛대·돛이 아래에서 솟아오른다 (메시 크기는 건드리지 않고 위치만)
  const baseY = tall.map((m) => m.position.y);
  tall.forEach((m) => {
    m.position.y -= RISE;
    m.visible = true;
  });
  const t0 = performance.now();
  while (performance.now() - t0 < 700) {
    if (stage.signal.aborted) return;
    const k = (performance.now() - t0) / 700;
    tall.forEach((m, i) => (m.position.y = baseY[i] - RISE * (1 - k) * (1 - k)));
    await sleep(16);
  }
  tall.forEach((m, i) => (m.position.y = baseY[i]));
  if (stage.signal.aborted) return;
  svc.audio.sfx('sail');
  fx.burst(at.clone().setY(y + 2), '#ffe066', 30, 6, 4);
  info.textContent = '뗏목 완성! 🎉';
  await sleep(1100);
  panel.remove();
  stage.cinematic = null;
  stage.unblock();
}
