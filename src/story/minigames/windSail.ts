import { BoxGeometry, ConeGeometry, Group, Mesh, MeshToonMaterial, Vector3 } from 'three';
import type { IslandStage } from '../../game/islandStage';
import { h, linked } from '../../ui/dom';

/** 바람 화살표와 돛의 방향을 맞춰 여섯 번 바람을 받으면 이타카가 보인다. */
export async function windSail(stage: IslandStage, at: Vector3): Promise<void> {
  if (stage.signal.aborted) return;
  const life = linked(stage.signal);
  const oldCinematic = stage.cinematic;
  const oldPosition = stage.player.pos.clone();
  const oldHeading = stage.player.heading;
  const oldVisible = stage.player.root.visible;
  const tableau = new Group();
  const geometry = new BoxGeometry(1, 1, 1);
  const arrowGeometry = new ConeGeometry(0.5, 1, 3);
  const materials = new Map<string, MeshToonMaterial>();
  let panel: HTMLDivElement | null = null;
  let frame = 0;
  stage.block();

  try {
    const box = (parent: Group, color: string, size: [number, number, number], pos: [number, number, number]) => {
      let material = materials.get(color);
      if (!material) {
        material = new MeshToonMaterial({ color });
        materials.set(color, material);
      }
      const mesh = new Mesh(geometry, material);
      mesh.scale.set(...size);
      mesh.position.set(...pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const y = stage.world.ground(at.x, at.z) + 5;
    tableau.position.set(at.x, y, at.z);
    // 바다 쪽에서 바라봐야 항구의 높은 시계탑이 배를 가리지 않는다.
    tableau.rotation.y = Math.PI;
    box(tableau, '#1b9fc5', [12, 0.45, 15], [0, -0.3, 0]);
    const waves = Array.from({ length: 12 }, (_, i) => box(tableau, '#8fdbe5', [1.1, 0.025, 0.12], [((i * 3) % 9) - 4, 0, i - 6]));
    const island = new Group();
    island.position.set(0, 0, 5.5);
    box(island, '#f3d7a0', [5.4, 0.3, 3.3], [0, 0.05, 0]);
    box(island, '#8ac66c', [4.6, 0.15, 2.7], [0, 0.27, 0]);
    for (const x of [-0.8, 0.8]) box(island, '#f2eee3', [0.22, 1.2, 0.22], [x, 0.9, 0]);
    box(island, '#f2eee3', [2.2, 0.2, 1.1], [0, 1.6, 0]);
    box(island, '#4b79b1', [2.4, 0.25, 1.3], [0, 1.83, 0]);
    for (const x of [-2, 2]) {
      box(island, '#a0794d', [0.16, 0.9, 0.16], [x, 0.75, 0.45]);
      box(island, '#5d985d', [0.95, 0.7, 0.8], [x, 1.35, 0.45]);
    }
    tableau.add(island);
    const boat = new Group();
    box(boat, '#855e3c', [2.2, 0.5, 3.6], [0, 0.2, 0]);
    box(boat, '#d4ab6d', [2.5, 0.15, 3.8], [0, 0.5, 0]);
    box(boat, '#b58b50', [0.12, 3.5, 0.12], [0, 2.1, 0]);
    box(boat, '#d8af5b', [2.4, 0.12, 0.12], [0, 3.4, 0]);
    const sail = new Group();
    sail.position.y = 2.45;
    box(sail, '#fff1d4', [2.1, 1.8, 0.08], [0, 0, 0]);
    box(sail, '#4a80bf', [0.16, 1.8, 0.1], [0, 0, 0.06]);
    boat.add(sail);
    boat.position.z = -4.6;
    tableau.add(boat);
    const wind = new Group();
    wind.position.set(-3.8, 3.3, -0.8);
    const arrowMaterial = new MeshToonMaterial({ color: '#ffe081' });
    materials.set('wind-arrow', arrowMaterial);
    const arrow = new Mesh(arrowGeometry, arrowMaterial);
    arrow.rotation.x = Math.PI / 2;
    arrow.position.z = 0.5;
    wind.add(arrow);
    box(wind, '#ffe081', [0.18, 0.15, 1.7], [0, 0, -0.7]);
    tableau.add(wind);
    stage.scene.add(tableau);
    stage.player.root.visible = false;
    stage.cinematic = {
      pos: new Vector3(at.x - 8, y + 11, at.z + 15),
      look: new Vector3(at.x, y + 0.6, at.z - 0.8),
    };

    const title = h('strong', { text: '⛵ 바람 따라 이타카로', style: { fontSize: 'calc(clamp(18px, 4vw, 23px) * var(--t))' } });
    const target = h('div', { style: { fontSize: 'calc(19px * var(--t))', fontWeight: '700' } });
    const direction = h('div', { style: { fontSize: 'calc(16px * var(--t))' } });
    const progress = h('div', { text: '이타카까지 바람 0 / 6', style: { fontSize: 'calc(16px * var(--t))' } });
    const message = h('div', { text: '← →로 돛 돌리기 · Space로 바람 받기', 'aria-live': 'polite', style: { minHeight: '20px', fontSize: 'calc(14px * var(--t))', lineHeight: '1.4' } });
    const left = h('button', { class: 'btn blue', type: 'button', text: '← 돛', 'aria-label': '왼쪽으로 돛 돌리기' });
    const catchButton = h('button', { class: 'btn gold', type: 'button', text: '바람 받기', 'aria-label': '바람 받기' });
    const right = h('button', { class: 'btn blue', type: 'button', text: '돛 →', 'aria-label': '오른쪽으로 돛 돌리기' });
    for (const button of [left, catchButton, right]) {
      Object.assign(button.style, { pointerEvents: 'auto', touchAction: 'manipulation', minHeight: '48px', padding: '9px 10px', fontSize: 'calc(17px * var(--t))', minWidth: '0' });
    }
    const controls = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1.7fr 1fr', gap: '8px', width: '100%' } }, left, catchButton, right);
    panel = h('div', {
      class: 'mini-panel',
      style: { width: 'min(94vw, 570px)', left: '50%', right: 'auto', transform: 'translateX(-50%)', bottom: 'max(12px, env(safe-area-inset-bottom))', gap: '6px', boxSizing: 'border-box', padding: '12px', borderRadius: '18px', background: 'rgba(255, 255, 255, 0.95)', color: '#193348', textAlign: 'center' },
    }, title, target, direction, progress, message, controls);
    stage.svc.ui.root.append(panel);
    catchButton.focus();

    const winds = [1, -1, 2, 0, -2, 1];
    const names = ['↖ 왼쪽 60°', '↖ 왼쪽 30°', '↑ 똑바로', '↗ 오른쪽 30°', '↗ 오른쪽 60°'];
    let sailDirection = 0;
    let caught = 0;
    let travelled = 0;
    let mistakes = 0;
    let sailing = 0;
    let elapsed = 0;
    let won = false;
    let celebration = 0;
    let last = performance.now();
    const paused = () => document.hidden || !!stage.svc.ui.root.querySelector('.screen.dim');
    const refresh = () => {
      const expected = winds[Math.min(caught, winds.length - 1)];
      target.textContent = `바람 ${names[expected + 2]}`;
      direction.textContent = `우리 돛 ${names[sailDirection + 2]}`;
      sail.rotation.y = -sailDirection * Math.PI / 6;
      wind.rotation.y = -expected * Math.PI / 6;
      catchButton.style.background = expected === sailDirection ? '#ffe081' : '#e8e1d1';
      progress.textContent = `이타카까지 바람 ${caught} / ${winds.length}`;
    };
    const turn = (step: number) => {
      if (paused() || won || sailing > 0) return;
      sailDirection = Math.max(-2, Math.min(2, sailDirection + step));
      stage.svc.audio.sfx('rope');
      refresh();
    };
    const catchWind = () => {
      if (paused() || won || sailing > 0) return;
      if (sailDirection !== winds[caught]) {
        mistakes++;
        message.textContent = mistakes >= 2 ? '위 바람과 아래 돛의 화살표를 같게 해요.' : '돛을 바람 화살표 쪽으로 돌려 봐요!';
        stage.svc.audio.sfx('hint');
        return;
      }
      caught++;
      sailing = 1.2;
      message.textContent = '순풍이에요! 배가 앞으로 나아가요.';
      stage.svc.audio.sfx('sail');
      left.disabled = right.disabled = catchButton.disabled = true;
      progress.textContent = `이타카까지 바람 ${caught} / ${winds.length}`;
    };
    left.addEventListener('click', () => turn(-1), { signal: life.signal });
    right.addEventListener('click', () => turn(1), { signal: life.signal });
    catchButton.addEventListener('click', catchWind, { signal: life.signal });
    window.addEventListener('keydown', (event) => {
      if (!['Space', 'ArrowLeft', 'ArrowRight'].includes(event.code) || paused()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (event.code === 'Space') catchWind();
      else turn(event.code === 'ArrowLeft' ? -1 : 1);
    }, { capture: true, signal: life.signal });
    refresh();

    await new Promise<void>((resolve) => {
      life.signal.addEventListener('abort', () => resolve(), { once: true });
      if (life.signal.aborted) { resolve(); return; }
      const tick = (now: number) => {
        if (life.signal.aborted) return;
        const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
        last = now;
        if (paused()) {
          frame = requestAnimationFrame(tick);
          return;
        }
        elapsed += dt;
        boat.position.y = 0.04 + Math.sin(elapsed * 3) * 0.06;
        boat.rotation.z = Math.sin(elapsed * 2.2) * 0.025;
        waves.forEach((wave, i) => { wave.position.z = ((i + 6 - elapsed * 0.6) % 12 + 12) % 12 - 6; });
        if (sailing > 0) {
          const step = Math.min(dt, sailing);
          sailing -= step;
          travelled += step / 1.2;
          boat.position.z = -4.6 + travelled * 1.25;
          if (sailing <= 0) {
            if (caught === winds.length) {
              won = true;
              message.textContent = '저기, 이타카가 보여요! 🎉';
              stage.svc.audio.sfx('victory');
            } else {
              left.disabled = right.disabled = catchButton.disabled = false;
              message.textContent = '바람이 바뀌었어요. 돛을 다시 맞춰요!';
              stage.svc.audio.sfx('wind');
              refresh();
            }
          }
        }
        if (won) {
          celebration += dt;
          if (celebration >= 1.1) { resolve(); return; }
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
  } finally {
    life.abort();
    cancelAnimationFrame(frame);
    panel?.remove();
    tableau.removeFromParent();
    geometry.dispose();
    arrowGeometry.dispose();
    materials.forEach((material) => material.dispose());
    stage.player.root.visible = oldVisible;
    stage.player.place(oldPosition.x, oldPosition.y, oldPosition.z, oldHeading);
    stage.cinematic = oldCinematic;
    stage.unblock();
  }
}
