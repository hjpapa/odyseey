import {
  BoxGeometry, BufferGeometry, ConeGeometry, Group, Mesh, MeshToonMaterial,
  TorusGeometry, Vector3, type Material,
} from 'three';
import type { IslandStage } from '../../game/islandStage';
import { h, linked } from '../../ui/dom';

/** One arrow flies through all twelve holes when their swaying line meets the sight. */
export async function axeArchery(stage: IslandStage, at: Vector3): Promise<void> {
  if (stage.signal.aborted) return;
  const life = linked(stage.signal);
  const previousCamera = stage.cinematic;
  const previousPosition = stage.player.pos.clone();
  const previousHeading = stage.player.heading;
  const scenery = new Group();
  scenery.name = 'mini-axe-archery';
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  let panel: HTMLDivElement | null = null;
  let frame = 0;
  stage.block();

  try {
    // Set the practice row beside the palace's fixed decorative axe row.
    const x = at.x - 3;
    const y = stage.world.ground(x, at.z);
    scenery.position.set(x, y, at.z);
    stage.scene.add(scenery);
    stage.player.place(x, stage.world.ground(x, at.z - 4.5), at.z - 4.5, 0);
    stage.cinematic = {
      pos: new Vector3(x + 5.8, y + 4.7, at.z - 8.5),
      look: new Vector3(x, y + 1.45, at.z - 0.4),
    };

    const cube = new BoxGeometry(1, 1, 1);
    const ring = new TorusGeometry(0.26, 0.065, 6, 24);
    const arrowTip = new ConeGeometry(0.1, 0.3, 8);
    geometries.push(cube, ring, arrowTip);
    const wood = new MeshToonMaterial({ color: '#9b6d40' });
    const metal = new MeshToonMaterial({ color: '#a9bac3' });
    const gold = new MeshToonMaterial({ color: '#e7ba3e' });
    materials.push(wood, metal, gold);
    const box = (parent: Group, material: MeshToonMaterial, width: number, height: number, depth: number, x: number, by: number, z: number) => {
      const mesh = new Mesh(cube, material);
      mesh.scale.set(width, height, depth);
      mesh.position.set(x, by, z);
      parent.add(mesh);
      return mesh;
    };
    const axes = Array.from({ length: 12 }, (_, index) => {
      const axe = new Group();
      axe.position.z = -2.75 + index * 0.5;
      box(axe, wood, 0.35, 0.1, 0.38, 0, 0.05, 0);
      box(axe, wood, 0.09, 1.25, 0.1, 0, 0.7, 0);
      box(axe, metal, 0.24, 0.42, 0.12, -0.4, 1.55, 0);
      box(axe, metal, 0.24, 0.42, 0.12, 0.4, 1.55, 0);
      const color = new MeshToonMaterial({ color: '#e7ba3e' });
      materials.push(color);
      const hole = new Mesh(ring, color);
      hole.position.y = 1.55;
      axe.add(hole);
      scenery.add(axe);
      return { axe, hole, color };
    });
    const arrow = new Group();
    box(arrow, gold, 0.045, 0.045, 0.65, 0, 0, -0.28);
    const tip = new Mesh(arrowTip, metal);
    tip.rotation.x = Math.PI / 2;
    arrow.add(tip);
    arrow.position.set(0, 1.55, -3.75);
    arrow.visible = false;
    scenery.add(arrow);
    const sight = new Mesh(ring, gold);
    sight.position.set(0, 1.55, -3.3);
    sight.scale.setScalar(1.15);
    scenery.add(sight);

    const status = h('div', { role: 'status', 'aria-live': 'polite', text: '구멍이 가운데에 모이면 쏘세요.' });
    const count = h('strong', { text: '관통한 도끼 0 / 12' });
    const dots = Array.from({ length: 12 }, (_, index) => h('span', {
      text: String(index + 1),
      style: { display: 'grid', placeItems: 'center', minWidth: '0', height: '24px', border: '2px solid #d2c4a5', borderRadius: '50%', fontSize: 'calc(11px * var(--t))', boxSizing: 'border-box', background: '#fffaf0' },
    }));
    const sequence = h('div', { 'aria-label': '도끼 열두 개', style: { display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '2px' } }, ...dots);
    const band = h('div', { style: { position: 'absolute', top: '0', bottom: '0', borderRadius: '8px', background: '#9bd3ac' } });
    const cursor = h('div', { style: { position: 'absolute', top: '-4px', width: '6px', height: '30px', background: '#9a5e32', borderRadius: '3px', transform: 'translateX(-50%)' } });
    const gauge = h('div', {
      role: 'progressbar', 'aria-label': '도끼 구멍 맞추기', 'aria-valuemin': 0, 'aria-valuemax': 100,
      style: { position: 'relative', height: '22px', width: '100%', borderRadius: '8px', background: '#e8deca', margin: '5px 0' },
    }, band, cursor);
    const button = h('button', {
      class: 'btn gold', type: 'button', text: '🏹 화살 쏘기 · Space',
      style: { width: '100%', boxSizing: 'border-box', fontSize: 'calc(18px * var(--t))', padding: '10px 12px', minHeight: '48px' },
    });
    const board = h('div', {
      style: { display: 'grid', gap: '8px', width: 'min(390px, calc(100vw - 24px))', boxSizing: 'border-box', padding: '14px', borderRadius: '18px', color: '#49391e', background: 'rgba(255, 252, 240, 0.97)', textAlign: 'center', pointerEvents: 'auto', boxShadow: '0 4px 0 #0002', fontSize: 'calc(16px * var(--t))' },
    }, h('strong', { text: '열두 도끼를 한 번에!', style: { fontSize: 'calc(21px * var(--t))' } }), count, sequence, gauge, status, button);
    panel = h('div', { class: 'mini-panel', 'data-minigame': 'axeArchery' }, board);
    stage.svc.ui.root.append(panel);
    button.focus();

    let state: 'aim' | 'flight' | 'finish' = 'aim';
    let clock = 0;
    let activeTime = 0;
    let sway = 0.6;
    let misses = 0;
    let passed = 0;
    let hitLimit = 0;
    let cooldown = 0;
    let finishTime = 0;
    let assisted = false;
    let resolveGame = () => {};
    const paused = () => document.hidden || !!stage.svc.ui.root.querySelector('.screen.dim');
    const tolerance = () => misses > 0 ? 0.33 : 0.22;
    const assist = () => {
      assisted = true;
      sway = 0;
      status.textContent = '구멍이 나란해요. 지금 쏘세요!';
    };
    const paintCount = () => {
      count.textContent = `관통한 도끼 ${passed} / 12`;
      axes.forEach(({ color }, index) => color.color.set(index < passed ? '#6cc48a' : '#e7ba3e'));
      dots.forEach((dot, index) => {
        dot.style.background = index < passed ? '#a5dcad' : '#fffaf0';
        dot.style.borderColor = index < passed ? '#4a9b66' : '#d2c4a5';
      });
    };
    const press = () => {
      if (life.signal.aborted || paused() || state !== 'aim' || cooldown > 0) return;
      const radius = tolerance();
      hitLimit = Math.abs(sway) <= radius ? 12 : Math.max(0, Math.min(11, Math.floor(radius / Math.abs(sway) * 12)));
      passed = 0;
      paintCount();
      arrow.position.z = -3.75;
      arrow.visible = true;
      state = 'flight';
      button.disabled = true;
      status.textContent = '화살이 구멍을 지나가요!';
      stage.svc.audio.sfx('bow_release');
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
          cooldown = Math.max(0, cooldown - dt);
          if (state === 'aim') {
            clock += dt;
            if (activeTime > 18 && !assisted) assist();
            sway = assisted ? 0 : Math.sin(clock * (misses > 0 ? 1.05 : 1.55) + 0.85) * 0.8;
            axes.forEach(({ axe, hole }, index) => {
              axe.position.x = sway * (index + 1) / 12;
              hole.scale.setScalar(misses > 0 ? 1.35 : 1);
            });
            const radius = tolerance();
            band.style.left = `${50 - radius / 1.6 * 100}%`;
            band.style.width = `${radius / 0.8 * 100}%`;
            cursor.style.left = `${(sway / 1.6 + 0.5) * 100}%`;
            gauge.setAttribute('aria-valuenow', String(Math.round((sway / 1.6 + 0.5) * 100)));
            button.disabled = cooldown > 0;
          } else if (state === 'flight') {
            arrow.position.z += dt * 6;
            while (passed < hitLimit && arrow.position.z >= axes[passed].axe.position.z) {
              passed++;
              paintCount();
              stage.svc.audio.sfx('arrow_hit', { pitch: 0.85 + passed * 0.035 });
            }
            if (hitLimit < 12 && arrow.position.z >= axes[hitLimit].axe.position.z) {
              state = 'aim';
              arrow.visible = false;
              misses++;
              cooldown = 0.6;
              stage.svc.audio.sfx('hint');
              status.textContent = '괜찮아요. 천천히 한 번 더!';
              if (misses >= 2) assist();
            } else if (passed === 12) {
              state = 'finish';
              finishTime = 0.9;
              status.textContent = '열두 도끼를 모두 꿰뚫었어요! 🎉';
              stage.svc.audio.sfx('victory');
            }
          } else {
            arrow.position.z += dt * 3;
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
