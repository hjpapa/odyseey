import {
  CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshToonMaterial, SphereGeometry, Vector3,
  type BufferGeometry, type Material,
} from 'three';
import { getModel } from '../../core/models';
import type { IslandStage } from '../../game/islandStage';
import { h, linked } from '../../ui/dom';

const PASSES = 4;
const FLIGHT = 2.8;
const RETURN_FLIGHT = 1.2;

/** 나우시카가 던지는 공을 받고 돌려준다. 놓치면 받는 시간이 넉넉해진다. */
export async function ballGame(stage: IslandStage, at: Vector3): Promise<void> {
  if (stage.signal.aborted) return;
  const controller = linked(stage.signal);
  const { signal } = controller;
  const { svc, world } = stage;
  const previousCinematic = stage.cinematic;
  const previousPosition = stage.player.pos.clone();
  const previousHeading = stage.player.heading;
  const previousFocus = document.activeElement;
  const objects = new Group();
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  let panel: HTMLElement | null = null;
  let frame = 0;

  stage.block();
  try {
    stage.scene.add(objects);
    const playerPosition = new Vector3(at.x, world.ground(at.x, at.z - 2.6), at.z - 2.6);
    const partnerPosition = new Vector3(at.x, world.ground(at.x, at.z + 3.3), at.z + 3.3);
    stage.player.place(playerPosition.x, playerPosition.y, playerPosition.z, 0);
    const partner = getModel('nausicaa');
    partner.position.copy(partnerPosition);
    partner.rotation.y = Math.PI;
    objects.add(partner);
    const gold = new MeshToonMaterial({ color: '#f4bf4f' });
    const coral = new MeshToonMaterial({ color: '#ef8d73' });
    const pale = new MeshBasicMaterial({ color: '#fff0bf', transparent: true, opacity: 0.7 });
    [gold, coral, pale].forEach((material) => materials.add(material));
    const ballGeometry = new SphereGeometry(0.35, 16, 12);
    const stripeGeometry = new CylinderGeometry(0.36, 0.36, 0.1, 16);
    const targetGeometry = new CylinderGeometry(0.8, 0.8, 0.06, 24);
    [ballGeometry, stripeGeometry, targetGeometry].forEach((geometry) => geometries.add(geometry));
    const ball = new Group();
    const sphere = new Mesh(ballGeometry, coral);
    const stripe = new Mesh(stripeGeometry, gold);
    stripe.rotation.z = 0.4;
    ball.add(sphere, stripe);
    objects.add(ball);
    ball.visible = false;
    const target = new Mesh(targetGeometry, pale);
    target.position.copy(playerPosition).setY(playerPosition.y + 0.06);
    objects.add(target);
    const from = partnerPosition.clone().add(new Vector3(0, 1.25, 0));
    const to = playerPosition.clone().add(new Vector3(0, 1.1, 0));
    stage.cinematic = {
      pos: new Vector3(at.x + 6, Math.max(playerPosition.y, partnerPosition.y) + 8, at.z - 11),
      look: at.clone().setY((playerPosition.y + partnerPosition.y) / 2 + 1.2),
    };

    const title = h('strong', { text: '⚽ 나우시카와 공놀이', style: { fontSize: '20px', textAlign: 'center' } });
    const score = h('div', { text: `주고받은 공 0 / ${PASSES}`, style: { fontSize: '17px' } });
    const status = h('div', {
      role: 'status', 'aria-live': 'polite', text: '공이 노란 자리에 오면 받아서 보내요.',
      style: { minHeight: '42px', fontSize: '16px', lineHeight: '1.35', textAlign: 'center' },
    });
    const pausedNotice = h('div', { text: '잠시 쉬는 중이에요.', hidden: true, style: { fontSize: '15px' } });
    const targetZone = h('div', {
      'aria-hidden': 'true',
      style: { position: 'absolute', left: '73%', right: '3%', top: '7px', bottom: '7px', borderRadius: '15px', background: '#ffe69a', border: '2px solid #d69d22' },
    });
    const ballIcon = h('span', {
      text: '⚽', 'aria-hidden': 'true',
      style: { position: 'absolute', top: '50%', left: '8%', transform: 'translate(-50%, -50%)', fontSize: '30px', lineHeight: '1' },
    });
    const track = h('div', {
      'aria-label': '나우시카에서 내 쪽으로 오는 공',
      style: { position: 'relative', width: '100%', height: '66px', borderRadius: '18px', background: '#e0f1fc', border: '2px solid #9bc4d7', boxSizing: 'border-box', pointerEvents: 'auto', overflow: 'hidden' },
    }, targetZone, ballIcon);
    const names = h('div', {
      style: { display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '14px', padding: '0 8px', boxSizing: 'border-box' },
    }, h('span', { text: '나우시카' }), h('span', { text: '나 🙌' }));
    const action = h('button', {
      class: 'btn gold', type: 'button', text: '⚽ 공놀이 시작',
      style: { width: '100%', fontSize: '19px', padding: '10px 8px', touchAction: 'manipulation' },
    });
    panel = h('div', {
      class: 'mini-panel', 'data-minigame': 'ballGame',
      style: {
        left: '50%', right: 'auto', bottom: 'max(14px, env(safe-area-inset-bottom))', transform: 'translateX(-50%)',
        width: 'min(94vw, 420px)', maxHeight: 'calc(100dvh - 100px)', overflowY: 'auto', boxSizing: 'border-box',
        padding: '12px', gap: '8px', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.97)', color: '#24415c', pointerEvents: 'auto',
      },
    }, title, score, status, pausedNotice, names, track, action,
    h('div', { text: 'Space 또는 받기 버튼을 눌러요.', style: { fontSize: '13px', textAlign: 'center' } }));
    svc.ui.root.append(panel);
    action.focus();

    let state: 'ready' | 'incoming' | 'returning' | 'won' = 'ready';
    let passes = 0;
    let misses = 0;
    let turnTime = 0;
    let lastTime = performance.now();
    const paused = () => document.hidden || !!svc.ui.root.querySelector('.screen.dim');
    const windowSize = () => 0.5 + Math.min(misses, 2) * 0.3;
    const beginPass = () => {
      state = 'incoming';
      turnTime = -0.25;
      ball.visible = true;
      action.textContent = '🙌 받아서 보내기';
      targetZone.style.left = `${8 + ((FLIGHT - windowSize()) / FLIGHT) * 80}%`;
      status.textContent = '공이 노란 자리에 오면 눌러요!';
    };

    await new Promise<void>((resolve) => {
      signal.addEventListener('abort', () => resolve(), { once: true });
      if (signal.aborted) return resolve();
      const press = () => {
        if (signal.aborted || paused()) return;
        if (state === 'won') return resolve();
        if (state === 'ready') {
          beginPass();
          svc.audio.sfx('ui_click');
          return;
        }
        if (state === 'returning') return;
        if (turnTime < FLIGHT - windowSize()) {
          misses = Math.min(2, misses + 1);
          targetZone.style.left = `${8 + ((FLIGHT - windowSize()) / FLIGHT) * 80}%`;
          status.textContent = '조금만 기다려요. 노란 자리를 넓혔어요!';
          svc.audio.sfx('hint', { volume: 0.35 });
          return;
        }
        passes++;
        score.textContent = `주고받은 공 ${passes} / ${PASSES}`;
        state = 'returning';
        turnTime = 0;
        status.textContent = '잘 받았어요! 나우시카에게 보내요.';
        svc.audio.sfx('correct', { volume: 0.45, pitch: 0.9 + passes * 0.05 });
      };
      action.addEventListener('click', press, { signal });
      window.addEventListener('keydown', (event) => {
        if (event.code !== 'Space' || paused()) return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) press();
      }, { capture: true, signal });
      const animate = (now: number) => {
        if (signal.aborted) return;
        const dt = Math.max(0, Math.min(0.05, (now - lastTime) / 1000));
        lastTime = now;
        const isPaused = paused();
        pausedNotice.hidden = !isPaused;
        if (!isPaused && (state === 'incoming' || state === 'returning')) {
          turnTime += dt;
          if (state === 'incoming') {
            if (misses < 2 && turnTime > FLIGHT + windowSize()) {
              misses++;
              turnTime = -0.6;
              targetZone.style.left = `${8 + ((FLIGHT - windowSize()) / FLIGHT) * 80}%`;
              status.textContent = misses === 2 ? '이번엔 공이 기다려 줘요. 천천히 받아요!' : '괜찮아요. 한 번 더 보내 줄게요!';
              svc.audio.sfx('hint', { volume: 0.4 });
            }
            const progress = Math.max(0, Math.min(1, turnTime / FLIGHT));
            ball.position.lerpVectors(from, to, progress);
            ball.position.y += Math.sin(progress * Math.PI) * 2.1;
            ballIcon.style.left = `${8 + progress * 80}%`;
            target.scale.setScalar(1 + Math.sin(Math.min(turnTime, FLIGHT) * 3) * 0.08);
          } else {
            const progress = Math.min(1, turnTime / RETURN_FLIGHT);
            ball.position.lerpVectors(to, from, progress);
            ball.position.y += Math.sin(progress * Math.PI) * 1.8;
            ballIcon.style.left = `${88 - progress * 80}%`;
            if (progress >= 1) {
              if (passes === PASSES) {
                state = 'won';
                ball.visible = false;
                status.textContent = '모두 잘했어요! 공놀이 성공!';
                action.textContent = '다음으로 ▶';
                svc.audio.sfx('victory', { volume: 0.5 });
              } else {
                misses = 0;
                beginPass();
              }
            }
          }
          ball.rotation.y += dt * 2;
          ball.rotation.z += dt;
        }
        frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
    });
  } finally {
    controller.abort();
    cancelAnimationFrame(frame);
    panel?.remove();
    objects.removeFromParent();
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    stage.cinematic = previousCinematic;
    stage.player.place(previousPosition.x, previousPosition.y, previousPosition.z, previousHeading);
    stage.unblock();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  }
}
