/** 1장 미니게임 — 모은 통나무를 하나씩 놓아 뗏목을 만들고 돛을 올린다 */
import { Vector3 } from 'three';
import { makeProp } from '../../world/props';
import type { IslandStage } from '../../game/islandStage';
import { h, sleep } from '../../ui/dom';

const PRESSES = 5;

export async function raftBuild(stage: IslandStage, at: Vector3): Promise<void> {
  const { svc, world, fx } = stage;
  stage.block();
  const raft = makeProp('raft');
  const y = world.ground(at.x, at.z);
  raft.position.set(at.x, y, at.z);
  raft.rotation.y = Math.atan2(at.x, at.z) + Math.PI / 2;
  const mast = raft.getObjectByName('mast');
  const logs = raft.children.filter((c) => c !== mast);
  const progressive = logs.length >= PRESSES;
  if (progressive) logs.forEach((l) => (l.visible = false));
  else raft.scale.setScalar(0.2);
  if (mast) mast.scale.y = 0.001;
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
        const show = Math.ceil((placed / PRESSES) * logs.length);
        logs.forEach((l, i) => (l.visible = i < show));
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
  info.textContent = '⛵ 돛을 올려요!';
  svc.audio.sfx('rope');
  await sleep(350);
  if (mast) {
    const t0 = performance.now();
    while (performance.now() - t0 < 700) {
      if (stage.signal.aborted) return;
      mast.scale.y = Math.max(0.001, (performance.now() - t0) / 700);
      await sleep(16);
    }
    mast.scale.y = 1;
  }
  if (stage.signal.aborted) return;
  raft.scale.setScalar(1);
  svc.audio.sfx('sail');
  fx.burst(at.clone().setY(y + 2), '#ffe066', 30, 6, 4);
  info.textContent = '뗏목 완성! 🎉';
  await sleep(1100);
  panel.remove();
  stage.cinematic = null;
  stage.unblock();
}
