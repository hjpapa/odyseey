import {
  BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshToonMaterial, SphereGeometry, Vector3,
  type BufferGeometry, type Material,
} from 'three';
import type { IslandStage } from '../../game/islandStage';
import { h, linked } from '../../ui/dom';

const MELODY = [1, 0, 2, 1, 2, 0];
const ARRIVAL = 2.6;

/** 줄의 x — 카메라가 +z 쪽을 보므로 화면 왼쪽이 +x 다 ('← 왼쪽' 버튼 = 화면 왼쪽 줄) */
export const laneX = (lane: number) => (1 - lane) * 1.65;

/** 세 줄의 음표를 골라 방패로 받는다. 놓친 음표는 더 천천히 연습한다. */
export async function rhythmShield(stage: IslandStage, at: Vector3): Promise<void> {
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
    const y = world.ground(at.x, at.z);
    objects.position.set(at.x, y, at.z);
    stage.scene.add(objects);
    const laneMaterial = new MeshToonMaterial({ color: '#395b77' });
    const gold = new MeshToonMaterial({ color: '#ffd56a' });
    const bronze = new MeshToonMaterial({ color: '#b97f40' });
    const noteMaterial = new MeshBasicMaterial({ color: '#fcdf74' });
    const lineMaterial = new MeshBasicMaterial({ color: '#98e4ec', transparent: true, opacity: 0.65 });
    [laneMaterial, gold, bronze, noteMaterial, lineMaterial].forEach((material) => materials.add(material));
    const mesh = (geometry: BufferGeometry, material: Material, x: number, height: number, z: number, parent = objects) => {
      geometries.add(geometry);
      const object = new Mesh(geometry, material);
      object.position.set(x, height, z);
      parent.add(object);
      return object;
    };
    for (let lane = 0; lane < 3; lane++) {
      const x = laneX(lane);
      mesh(new BoxGeometry(1.4, 0.08, 5.4), laneMaterial, x, 0.12, 1.5);
      mesh(new BoxGeometry(1.4, 0.05, 0.18), lineMaterial, x, 0.19, -0.7);
      mesh(new BoxGeometry(0.04, 0.05, 5.4), lineMaterial, x - 0.69, 0.18, 1.5);
    }
    const shield = new Group();
    objects.add(shield);
    const face = mesh(new CylinderGeometry(0.6, 0.6, 0.14, 16), gold, 0, 0, 0, shield);
    face.rotation.x = Math.PI / 2;
    mesh(new SphereGeometry(0.18, 10, 8), bronze, 0, 0, 0.12, shield);
    shield.position.set(0, 1.25, -0.8);
    const note = new Group();
    objects.add(note);
    mesh(new SphereGeometry(0.26, 12, 8), noteMaterial, -0.16, 0, 0, note).scale.set(1.2, 0.8, 0.8);
    mesh(new BoxGeometry(0.1, 0.8, 0.1), noteMaterial, 0.08, 0.35, 0, note);
    const flag = mesh(new BoxGeometry(0.45, 0.12, 0.12), noteMaterial, 0.24, 0.69, 0, note);
    flag.rotation.z = -0.4;
    note.visible = false;

    stage.player.place(at.x, world.ground(at.x, at.z - 2), at.z - 2, 0);
    stage.cinematic = {
      pos: new Vector3(at.x + 0.8, y + 8, at.z - 10),
      look: new Vector3(at.x, y + 1.1, at.z + 1.4),
    };

    const title = h('strong', { text: '🎶 리듬 방패', style: { fontSize: 'calc(20px * var(--t))' } });
    const progress = h('div', { text: `막은 음표 0 / ${MELODY.length}`, style: { fontSize: 'calc(17px * var(--t))' } });
    const status = h('div', {
      role: 'status', 'aria-live': 'polite', text: '음표가 내려오는 줄을 골라요.',
      style: { minHeight: '40px', fontSize: 'calc(16px * var(--t))', lineHeight: '1.3', textAlign: 'center' },
    });
    const pausedNotice = h('div', { text: '잠시 쉬는 중이에요.', hidden: true, style: { fontSize: 'calc(15px * var(--t))' } });
    const board = h('div', {
      'aria-label': '음표 세 줄',
      style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '5px', width: '100%', height: '120px', pointerEvents: 'auto' },
    });
    const names = ['← 왼쪽', '가운데', '오른쪽 →'];
    const lanes = names.map((name) => h('button', {
      type: 'button', 'aria-label': `${name.replace(/[←→]/g, '').trim()} 줄 선택`, 'aria-pressed': 'false',
      style: {
        position: 'relative', minWidth: '0', border: '2px solid #8fbed3', borderRadius: '12px', padding: '0',
        background: '#e6f4fa', color: '#20405b', cursor: 'pointer', touchAction: 'manipulation', overflow: 'hidden',
      },
    }, h('span', { text: name, style: { position: 'absolute', bottom: '4px', left: '0', right: '0', fontSize: 'calc(14px * var(--t))' } }),
    h('span', { style: { position: 'absolute', left: '4%', right: '4%', top: '77%', height: '8px', background: '#f1bf42', borderRadius: '5px' } })));
    board.append(...lanes);
    const noteIcon = h('span', {
      text: '♪', 'aria-hidden': 'true',
      style: { position: 'absolute', left: '50%', top: '8%', transform: 'translate(-50%, -50%)', fontSize: 'calc(34px * var(--t))', lineHeight: '1', color: '#5148a2', pointerEvents: 'none' },
    });
    const action = h('button', { class: 'btn gold', type: 'button', text: '🎵 시작하기', style: { width: '100%', fontSize: 'calc(19px * var(--t))', padding: '10px 8px' } });
    const hint = h('div', { text: '← → 줄 고르기 · Space 방패', style: { fontSize: 'calc(13px * var(--t))', textAlign: 'center' } });
    panel = h('div', {
      class: 'mini-panel', 'data-minigame': 'rhythmShield',
      style: {
        left: '50%', right: 'auto', bottom: 'max(14px, env(safe-area-inset-bottom))', transform: 'translateX(-50%)',
        width: 'min(94vw, 420px)', maxHeight: 'calc(100dvh - 100px)', overflowY: 'auto', boxSizing: 'border-box',
        padding: '12px', gap: '7px', borderRadius: '20px', background: 'rgba(255, 255, 255, 0.97)', color: '#20405b', pointerEvents: 'auto',
      },
    }, title, progress, status, pausedNotice, board, action, hint);
    svc.ui.root.append(panel);
    action.focus();

    let state: 'ready' | 'playing' | 'won' = 'ready';
    let selectedLane = 1;
    let caught = 0;
    let misses = 0;
    let noteTime = -0.4;
    let lastTime = performance.now();
    const paused = () => document.hidden || !!svc.ui.root.querySelector('.screen.dim');
    const windowSize = () => 0.4 + Math.min(misses, 2) * 0.25;
    const chooseLane = (lane: number) => {
      selectedLane = lane;
      lanes.forEach((button, index) => {
        button.setAttribute('aria-pressed', String(index === lane));
        button.style.background = index === lane ? '#bfeaf3' : '#e6f4fa';
        button.style.borderColor = index === lane ? '#286aa0' : '#8fbed3';
      });
      shield.position.x = laneX(lane);
    };
    const showNote = () => {
      const lane = MELODY[caught];
      lanes[lane].append(noteIcon);
      chooseLane(selectedLane);
    };
    chooseLane(selectedLane);

    await new Promise<void>((resolve) => {
      signal.addEventListener('abort', () => resolve(), { once: true });
      if (signal.aborted) return resolve();
      const press = () => {
        if (signal.aborted || paused()) return;
        if (state === 'won') return resolve();
        if (state === 'ready') {
          state = 'playing';
          action.textContent = '🛡️ 박자 맞춰 막기';
          status.textContent = '노란 선에 오면 방패를 들어요!';
          showNote();
          svc.audio.sfx('ui_click');
          return;
        }
        if (selectedLane !== MELODY[caught]) {
          status.textContent = '음표가 있는 줄을 먼저 골라요!';
          svc.audio.sfx('hint', { volume: 0.4 });
          return;
        }
        if (noteTime < ARRIVAL - windowSize()) {
          misses = Math.min(2, misses + 1);
          status.textContent = '조금만 기다렸다가 노란 선에서!';
          return;
        }
        caught++;
        progress.textContent = `막은 음표 ${caught} / ${MELODY.length}`;
        svc.audio.sfx('shield_block', { volume: 0.5, pitch: 1 + caught * 0.05 });
        shield.scale.setScalar(1.2);
        if (caught === MELODY.length) {
          state = 'won';
          note.visible = false;
          noteIcon.remove();
          status.textContent = '모든 음표를 막았어요! 친구들과 함께했어요.';
          action.textContent = '다음으로 ▶';
          svc.audio.sfx('victory', { volume: 0.5 });
        } else {
          noteTime = -0.4;
          misses = 0;
          status.textContent = '좋아요! 다음 음표도 받아 봐요.';
          showNote();
        }
      };
      action.addEventListener('click', press, { signal });
      lanes.forEach((button, lane) => button.addEventListener('click', () => {
        if (signal.aborted || paused()) return;
        chooseLane(lane);
        svc.audio.sfx('ui_click', { volume: 0.35 });
      }, { signal }));
      window.addEventListener('keydown', (event) => {
        if (paused() || !['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;
        if (event.code === 'ArrowLeft') chooseLane(Math.max(0, selectedLane - 1));
        else if (event.code === 'ArrowRight') chooseLane(Math.min(2, selectedLane + 1));
        else press();
      }, { capture: true, signal });
      const animate = (now: number) => {
        if (signal.aborted) return;
        const dt = Math.max(0, Math.min(0.05, (now - lastTime) / 1000));
        lastTime = now;
        const isPaused = paused();
        pausedNotice.hidden = !isPaused;
        if (!isPaused && state === 'playing') {
          noteTime += dt;
          if (misses < 2 && noteTime > ARRIVAL + windowSize()) {
            misses++;
            noteTime = -0.6;
            status.textContent = misses === 2 ? '이번엔 선에서 기다려 줘요. 천천히 막아요!' : '괜찮아요! 한 번 더 천천히 해 봐요.';
            svc.audio.sfx('hint', { volume: 0.4 });
          }
          const progress = Math.max(0, Math.min(1, noteTime / ARRIVAL));
          note.visible = noteTime >= 0;
          note.position.set(laneX(MELODY[caught]), 1.25 + (1 - progress) * 3.4, 3.8 - progress * 4.6);
          noteIcon.style.top = `${8 + progress * 70}%`;
          noteIcon.style.visibility = noteTime >= 0 ? 'visible' : 'hidden';
          note.rotation.y += dt * 0.8;
          shield.scale.lerp(new Vector3(1, 1, 1), Math.min(1, dt * 8));
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
