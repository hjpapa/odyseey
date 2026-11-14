import { BoxGeometry, Group, Mesh, MeshToonMaterial, Vector3 } from 'three';
import { getModel } from '../../core/models';
import type { IslandStage } from '../../game/islandStage';
import { h, linked } from '../../ui/dom';

/** 양들 곁에서 초록불에 걷고, 거인이 돌아보면 멈추는 작은 동굴 놀이. */
export async function sheepEscape(stage: IslandStage, at: Vector3): Promise<void> {
  if (stage.signal.aborted) return;
  const life = linked(stage.signal);
  const oldCinematic = stage.cinematic;
  const oldPosition = stage.player.pos.clone();
  const oldHeading = stage.player.heading;
  const oldVisible = stage.player.root.visible;
  const tableau = new Group();
  const geometry = new BoxGeometry(1, 1, 1);
  const materials = new Map<string, MeshToonMaterial>();
  let panel: HTMLDivElement | null = null;
  let frame = 0;
  stage.block();

  try {
    const box = (color: string, size: [number, number, number], pos: [number, number, number]) => {
      let material = materials.get(color);
      if (!material) {
        material = new MeshToonMaterial({ color });
        materials.set(color, material);
      }
      const mesh = new Mesh(geometry, material);
      mesh.scale.set(...size);
      mesh.position.set(...pos);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      tableau.add(mesh);
      return mesh;
    };
    const y = stage.world.ground(at.x, at.z) + 5;
    tableau.position.set(at.x, y, at.z);
    box('#a79883', [8.2, 0.4, 12], [0, -0.25, 0]);
    for (const x of [-3.8, 3.8]) {
      box('#747e8e', [0.5, 1.1, 12], [x, 0.4, 0]);
    }
    for (let i = 0; i < 11; i++) {
      box('#d7c9ab', [5.5, 0.04, 0.07], [0, 0, i - 5]);
    }
    box('#83c987', [5.7, 0.05, 0.8], [0, 0.02, 5]);
    const lamp = box('#58cd82', [0.65, 0.65, 0.65], [-3.2, 1.6, 4.6]);
    const sheep = [-1.6, 0, 1.6].map((x) => {
      const model = getModel('sheep');
      model.scale.setScalar(0.9);
      model.position.set(x, 0.05, -4.7);
      tableau.add(model);
      return model;
    });
    const hero = getModel('odysseus');
    hero.scale.setScalar(0.34);
    tableau.add(hero);
    const giant = getModel('polyphemus');
    giant.scale.setScalar(0.45);
    giant.position.set(2.7, 0.05, 4.4);
    tableau.add(giant);
    stage.scene.add(tableau);
    stage.player.root.visible = false;
    stage.cinematic = {
      pos: new Vector3(at.x + 8, y + 10, at.z - 14),
      look: new Vector3(at.x, y + 0.5, at.z + 0.5),
    };

    const title = h('strong', { text: '🐑 양들과 살금살금', style: { fontSize: 'clamp(18px, 4vw, 23px)' } });
    const signal = h('div', { text: '초록에 이동, 노랑에 손 떼기!', 'aria-live': 'polite', style: { fontWeight: '700', fontSize: '18px' } });
    const progress = h('div', { text: '동굴 출구까지 0%', style: { fontSize: '15px' } });
    const help = h('div', { text: 'Space 꾹 누르기 · ← → 옆 양으로 숨기', style: { fontSize: '14px', lineHeight: '1.35' } });
    const left = h('button', { class: 'btn gray', type: 'button', text: '← 양', 'aria-label': '왼쪽 양으로 숨기' });
    const move = h('button', { class: 'btn', type: 'button', text: '꾹 눌러 이동', 'aria-label': '양들과 이동' });
    const right = h('button', { class: 'btn gray', type: 'button', text: '양 →', 'aria-label': '오른쪽 양으로 숨기' });
    for (const button of [left, move, right]) {
      Object.assign(button.style, { pointerEvents: 'auto', touchAction: 'none', minHeight: '48px', padding: '9px 12px', fontSize: '17px', minWidth: '0' });
    }
    const controls = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1.7fr 1fr', gap: '8px', width: '100%' } }, left, move, right);
    panel = h('div', {
      class: 'mini-panel',
      style: { width: 'min(94vw, 570px)', left: '50%', right: 'auto', transform: 'translateX(-50%)', bottom: 'max(12px, env(safe-area-inset-bottom))', gap: '7px', boxSizing: 'border-box', padding: '12px', borderRadius: '18px', background: 'rgba(255, 255, 255, 0.95)', color: '#193348', textAlign: 'center' },
    }, title, signal, progress, help, controls);
    stage.svc.ui.root.append(panel);
    move.focus();

    let running = false;
    let held = false;
    let tapTime = 0;
    let lane = 1;
    let distance = 0;
    let phase: 'green' | 'yellow' | 'red' = 'green';
    let phaseTime = 0;
    let attempts = 0;
    let won = false;
    let celebration = 0;
    let last = performance.now();
    const paused = () => document.hidden || !!stage.svc.ui.root.querySelector('.screen.dim');
    const clearInput = () => { held = false; tapTime = 0; };
    const begin = () => {
      if (running) return;
      running = true;
      phase = 'green';
      phaseTime = 0;
      move.textContent = '꾹 눌러 이동';
      signal.textContent = '🟢 거인이 쉬어요. 양들과 이동!';
      stage.svc.audio.sfx('sheep');
    };
    const step = () => {
      if (paused() || won) return;
      begin();
      tapTime = 0.3;
    };
    const changeLane = (direction: number) => {
      if (paused() || won) return;
      begin();
      lane = Math.max(0, Math.min(2, lane + direction));
      tapTime = 0.15;
    };
    const fail = () => {
      attempts++;
      distance = Math.max(0, distance - 1.2);
      running = false;
      clearInput();
      signal.textContent = '괜찮아요! 노랑이 보이면 손을 떼요.';
      move.textContent = '다시 출발';
      stage.svc.audio.sfx('hint');
    };
    const onKey = (event: KeyboardEvent) => {
      if (!['Space', 'ArrowLeft', 'ArrowRight'].includes(event.code) || paused()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat || won) return;
      if (event.code === 'Space') {
        begin();
        held = true;
      } else changeLane(event.code === 'ArrowLeft' ? -1 : 1);
    };
    window.addEventListener('keydown', onKey, { capture: true, signal: life.signal });
    window.addEventListener('keyup', (event) => {
      if (event.code === 'Space') {
        held = false;
        event.preventDefault();
      }
    }, { capture: true, signal: life.signal });
    window.addEventListener('blur', clearInput, { signal: life.signal });
    document.addEventListener('visibilitychange', clearInput, { signal: life.signal });
    move.addEventListener('pointerdown', (event) => {
      if (paused() || won) return;
      event.preventDefault();
      move.setPointerCapture(event.pointerId);
      begin();
      held = true;
    }, { signal: life.signal });
    move.addEventListener('pointerup', () => { held = false; }, { signal: life.signal });
    move.addEventListener('pointercancel', clearInput, { signal: life.signal });
    move.addEventListener('lostpointercapture', clearInput, { signal: life.signal });
    move.addEventListener('click', step, { signal: life.signal });
    left.addEventListener('click', () => changeLane(-1), { signal: life.signal });
    right.addEventListener('click', () => changeLane(1), { signal: life.signal });

    await new Promise<void>((resolve) => {
      life.signal.addEventListener('abort', () => resolve(), { once: true });
      if (life.signal.aborted) { resolve(); return; }
      const tick = (now: number) => {
        if (life.signal.aborted) return;
        const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
        last = now;
        if (paused()) {
          clearInput();
          frame = requestAnimationFrame(tick);
          return;
        }
        if (won) {
          celebration += dt;
          if (celebration >= 1.1) { resolve(); return; }
        } else if (running) {
          phaseTime += dt;
          const greenTime = attempts >= 2 ? 5 : 3.8;
          const yellowTime = attempts >= 2 ? 1.8 : 1.1;
          if (phase === 'green' && phaseTime >= greenTime) {
            phase = 'yellow';
            phaseTime = 0;
            signal.textContent = '🟡 곧 돌아봐요. 손을 떼고 멈춰요!';
            stage.svc.audio.sfx('hint');
          } else if (phase === 'yellow' && phaseTime >= yellowTime) {
            phase = 'red';
            phaseTime = 0;
            signal.textContent = '🔴 거인이 돌아봐요. 가만히!';
          } else if (phase === 'red' && phaseTime >= 2) {
            phase = 'green';
            phaseTime = 0;
            signal.textContent = '🟢 다시 쉬어요. 출구로 이동!';
            stage.svc.audio.sfx('sheep');
          }
          const moving = held || tapTime > 0;
          tapTime = Math.max(0, tapTime - dt);
          if (phase === 'red' && phaseTime > 0.3 && moving) fail();
          else if (phase === 'green' && moving) distance = Math.min(9.4, distance + dt * 1.15);
          if (distance >= 9.4) {
            won = true;
            clearInput();
            signal.textContent = '양들과 무사히 나왔어요! 🎉';
            move.disabled = left.disabled = right.disabled = true;
            stage.svc.audio.sfx('victory');
          }
        }
        const colors = { green: '#58cd82', yellow: '#ffd15a', red: '#f07470' };
        (lamp.material as MeshToonMaterial).color.set(colors[phase]);
        giant.rotation.y += ((phase === 'red' ? Math.PI : 0) - giant.rotation.y) * Math.min(1, dt * 5);
        sheep.forEach((model, index) => {
          model.position.z = -4.7 + distance + (index === 1 ? 0 : 0.2);
          model.position.y = 0.05 + (running && phase === 'green' && (held || tapTime > 0) ? Math.abs(Math.sin(now * 0.006 + index)) * 0.07 : 0);
        });
        hero.position.set((1 - lane) * 1.6, 0.03, -5.1 + distance);
        progress.textContent = `동굴 출구까지 ${Math.round(distance / 9.4 * 100)}%`;
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
    materials.forEach((material) => material.dispose());
    stage.player.root.visible = oldVisible;
    stage.player.place(oldPosition.x, oldPosition.y, oldPosition.z, oldHeading);
    stage.cinematic = oldCinematic;
    stage.unblock();
  }
}
