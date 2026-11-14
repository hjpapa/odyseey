import {
  BoxGeometry, BufferGeometry, Group, Line, LineBasicMaterial, Mesh,
  MeshToonMaterial, TorusGeometry, Vector3, type Material,
} from 'three';
import type { IslandStage } from '../../game/islandStage';
import { h, linked } from '../../ui/dom';

/** Seat the bowstring with three deliberate presses inside the moving green band. */
export async function bowString(stage: IslandStage, at: Vector3): Promise<void> {
  if (stage.signal.aborted) return;
  const life = linked(stage.signal);
  const previousCamera = stage.cinematic;
  const previousPosition = stage.player.pos.clone();
  const previousHeading = stage.player.heading;
  const scenery = new Group();
  scenery.name = 'mini-bow-string';
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  let panel: HTMLDivElement | null = null;
  let frame = 0;
  stage.block();

  try {
    const y = stage.world.ground(at.x, at.z);
    scenery.position.set(at.x, y, at.z);
    stage.scene.add(scenery);
    stage.player.place(at.x + 2.6, stage.world.ground(at.x + 2.6, at.z - 1.4), at.z - 1.4, -1.08);
    stage.cinematic = {
      pos: new Vector3(at.x + 5, y + 5.2, at.z - 7),
      look: new Vector3(at.x, y + 1.6, at.z),
    };

    const cube = new BoxGeometry(1, 1, 1);
    const arc = new TorusGeometry(1.25, 0.08, 8, 32, Math.PI);
    const stringGeometry = new BufferGeometry().setFromPoints([
      new Vector3(0, 1.25, 0), new Vector3(0.2, 0, 0), new Vector3(0, -1.25, 0),
    ]);
    geometries.push(cube, arc, stringGeometry);
    const wood = new MeshToonMaterial({ color: '#965f32' });
    const gold = new MeshToonMaterial({ color: '#e6b440' });
    const stringMaterial = new LineBasicMaterial({ color: '#fff5ce' });
    materials.push(wood, gold, stringMaterial);
    const bow = new Group();
    bow.position.y = 1.65;
    scenery.add(bow);
    const limb = new Mesh(arc, wood);
    limb.rotation.z = Math.PI / 2;
    bow.add(limb, new Line(stringGeometry, stringMaterial));
    const grip = new Mesh(cube, gold);
    grip.scale.set(0.22, 0.42, 0.18);
    grip.position.x = -1.22;
    bow.add(grip);
    const base = new Mesh(cube, wood);
    base.scale.set(1.5, 0.2, 0.85);
    base.position.y = 0.1;
    scenery.add(base);
    const marks = [0, 1, 2].map((index) => {
      const material = new MeshToonMaterial({ color: '#d4c7af' });
      materials.push(material);
      const mark = new Mesh(cube, material);
      mark.scale.set(0.26, 0.26, 0.26);
      mark.position.set((index - 1) * 0.48, 3.28, 0);
      scenery.add(mark);
      return mark;
    });

    const status = h('div', { role: 'status', 'aria-live': 'polite', text: '초록 가운데에 오면 눌러요.' });
    const count = h('strong', { text: '활시위 0 / 3' });
    const band = h('div', { style: { position: 'absolute', top: '0', bottom: '0', background: '#93d5a0', borderRadius: '8px' } });
    const cursor = h('div', { style: { position: 'absolute', top: '-4px', width: '5px', height: '32px', background: '#65491f', borderRadius: '4px', transform: 'translateX(-50%)' } });
    const gauge = h('div', {
      role: 'progressbar', 'aria-label': '활시위 타이밍', 'aria-valuemin': 0, 'aria-valuemax': 100,
      style: { position: 'relative', height: '24px', width: '100%', background: '#e4ddcf', borderRadius: '8px', margin: '8px 0' },
    }, band, cursor);
    const button = h('button', {
      class: 'btn gold', type: 'button', text: '🏹 활시위 걸기 · Space',
      style: { width: '100%', boxSizing: 'border-box', fontSize: '18px', padding: '10px 12px', minHeight: '48px' },
    });
    const board = h('div', {
      style: { display: 'grid', gap: '8px', width: 'min(360px, calc(100vw - 24px))', boxSizing: 'border-box', padding: '14px', borderRadius: '18px', color: '#49391e', background: 'rgba(255, 252, 240, 0.97)', textAlign: 'center', pointerEvents: 'auto', boxShadow: '0 4px 0 #0002', fontSize: '16px' },
    }, h('strong', { text: '오디세우스의 활', style: { fontSize: '21px' } }), count, gauge, status, button);
    panel = h('div', { class: 'mini-panel', 'data-minigame': 'bowString', style: { gap: '8px' } }, board);
    stage.svc.ui.root.append(panel);
    button.focus();

    let seated = 0;
    let misses = 0;
    let clock = 0;
    let activeTime = 0;
    let cooldown = 0;
    let finishTime = 0;
    let assisted = false;
    let value = 0.08;
    let resolveGame = () => {};
    const paused = () => document.hidden || !!stage.svc.ui.root.querySelector('.screen.dim');
    const assist = () => {
      assisted = true;
      value = 0.5;
      status.textContent = '가운데에 멈췄어요. 눌러요!';
    };
    const press = () => {
      if (life.signal.aborted || paused() || cooldown > 0 || seated === 3) return;
      const tolerance = misses > 0 ? 0.28 : 0.18;
      if (Math.abs(value - 0.5) <= tolerance) {
        (marks[seated].material as MeshToonMaterial).color.set('#66bf87');
        seated++;
        count.textContent = `활시위 ${seated} / 3`;
        cooldown = 0.45;
        stage.svc.audio.sfx('rope');
        status.textContent = seated < 3 ? '좋아요! 한 번 더 걸어요.' : '활시위를 모두 걸었어요! 🎉';
        if (seated === 3) {
          finishTime = 0.85;
          stage.svc.audio.sfx('bow_draw');
        }
      } else {
        misses++;
        cooldown = 0.35;
        stage.svc.audio.sfx('hint');
        status.textContent = '천천히 다시 해요. 초록 칸이 넓어져요.';
        if (misses >= 2) assist();
      }
      button.disabled = true;
    };

    await new Promise<void>((resolve) => {
      resolveGame = resolve;
      if (life.signal.aborted) { resolve(); return; }
      life.signal.addEventListener('abort', () => resolve(), { once: true });
      button.addEventListener('click', press, { signal: life.signal });
      window.addEventListener('keydown', (event) => {
        if (!['Space', 'Enter', 'NumpadEnter'].includes(event.code) || paused()) return;
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) press();
      }, { capture: true, signal: life.signal });
      let last = performance.now();
      const tick = (now: number) => {
        if (life.signal.aborted) return;
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
        last = now;
        if (!paused()) {
          activeTime += dt;
          clock += dt;
          cooldown = Math.max(0, cooldown - dt);
          if (activeTime > 18 && !assisted && seated < 3) assist();
          value = assisted ? 0.5 : (Math.sin(clock * (misses > 0 ? 1.4 : 2.05) - 1) + 1) / 2;
          const tolerance = misses > 0 ? 0.28 : 0.18;
          band.style.left = `${(0.5 - tolerance) * 100}%`;
          band.style.width = `${tolerance * 200}%`;
          cursor.style.left = `${value * 100}%`;
          gauge.setAttribute('aria-valuenow', String(Math.round(value * 100)));
          button.disabled = cooldown > 0 || seated === 3;
          const points = stringGeometry.getAttribute('position');
          points.setX(1, 0.2 + seated * 0.25 + value * 0.12);
          points.needsUpdate = true;
          if (seated === 3) {
            finishTime -= dt;
            if (finishTime <= 0) {
              resolveGame();
              return;
            }
          }
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
  } finally {
    life.abort();
    cancelAnimationFrame(frame);
    panel?.remove();
    scenery.removeFromParent();
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    stage.cinematic = previousCamera;
    stage.player.place(previousPosition.x, previousPosition.y, previousPosition.z, previousHeading);
    stage.unblock();
  }
}
