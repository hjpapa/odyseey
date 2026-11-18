import { BoxGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshToonMaterial, RingGeometry, Vector3 } from 'three';
import type { IslandStage } from '../../game/islandStage';
import { h, linked } from '../../ui/dom';
import { makeProp } from '../../world/props';

/** 무기를 골라 집은 뒤 창고에 놓는다. 탭·끌기와 방향키·Space를 지원한다. */
export async function hideWeapons(stage: IslandStage, at: Vector3): Promise<void> {
  if (stage.signal.aborted) return;
  const { svc, world } = stage;
  const controls = linked(stage.signal);
  const previousCamera = stage.cinematic;
  const objects = new Group();
  const ringGeometry = new RingGeometry(0.45, 0.58, 32);
  const ringMaterial = new MeshBasicMaterial({ color: '#ffd34d', side: DoubleSide });
  const ring = new Mesh(ringGeometry, ringMaterial);
  const boardGeometry = new BoxGeometry(6, 0.18, 6.5);
  const boardMaterial = new MeshToonMaterial({ color: '#c59562' });
  let panel: HTMLElement | undefined;
  let finish: (() => void) | undefined;
  let resultTimer: ReturnType<typeof setTimeout> | undefined;
  stage.block();
  try {
    const ground = world.ground(at.x, at.z);
    const displayHeight = ground + 5;
    objects.position.set(at.x, displayHeight, at.z);
    const board = new Mesh(boardGeometry, boardMaterial);
    board.position.set(0, -0.2, 0.7);
    objects.add(board);
    const store = makeProp('crate');
    store.position.set(0, 0, 2.7);
    store.scale.setScalar(1.5);
    objects.add(store);
    const equipment = [
      { model: 'sword', name: '검 하나' },
      { model: 'shield', name: '방패 하나' },
      { model: 'bow', name: '활' },
      { model: 'sword', name: '검 둘' },
      { model: 'shield', name: '방패 둘' },
      { model: 'sword', name: '검 셋' },
    ] as const;
    const meshes = equipment.map((item, index) => {
      const mesh = makeProp(item.model);
      mesh.position.set((index % 3 - 1) * 1.7, 0.4, index < 3 ? -1.4 : 0.6);
      mesh.rotation.z = item.model === 'sword' ? -0.6 : 0;
      objects.add(mesh);
      return mesh;
    });
    ring.rotation.x = -Math.PI / 2;
    objects.add(ring);
    stage.scene.add(objects);
    stage.cinematic = {
      pos: new Vector3(at.x + 5, displayHeight + 8, at.z - 8),
      look: new Vector3(at.x, displayHeight + 0.3, at.z + 0.5),
    };

    const info = h('div', { text: '📦 0 / 6개 정리했어요', role: 'status', 'aria-live': 'polite' });
    const hint = h('p', { text: '무기를 고른 뒤 창고에 놓아요.', style: { margin: '4px 0', fontSize: 'calc(16px * var(--t))' } });
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' } });
    const action = h('button', { class: 'btn gold', type: 'button', text: '🤲 무기 집기',
      style: { minHeight: '48px', fontSize: 'calc(18px * var(--t))', padding: '8px 12px', touchAction: 'none' } });
    const card = h('div', {
      style: {
        width: 'min(94vw, 500px)', boxSizing: 'border-box', padding: '12px',
        display: 'flex', flexDirection: 'column', gap: '6px',
        background: 'rgba(255, 252, 238, 0.97)', borderRadius: '18px', color: '#203456',
        boxShadow: '0 4px 12px #10243b44', textAlign: 'center', pointerEvents: 'auto',
      },
    },
    h('strong', { text: '텔레마코스와 준비물 정리', style: { fontSize: 'calc(20px * var(--t))' } }),
    hint, info, grid,
    h('div', { style: { display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' } },
      h('button', { class: 'btn gray small', type: 'button', text: '◀', 'aria-label': '이전 무기' }),
      action,
      h('button', { class: 'btn gray small', type: 'button', text: '▶', 'aria-label': '다음 무기' })),
    h('small', { text: '← → 고르기 · Space 집기/놓기 · 끌어서 놓기도 돼요',
      style: { display: 'block', fontSize: 'calc(12px * var(--t))', lineHeight: '1.4' } }));
    panel = h('div', { class: 'mini-panel', 'data-minigame': 'hideWeapons', role: 'group', 'aria-label': '무기 숨기기' }, card);
    svc.ui.root.append(panel);

    let selected = 0;
    let held: number | null = null;
    let count = 0;
    let complete = false;
    const stored = equipment.map(() => false);
    const buttons = equipment.map((item, index) => {
      const button = h('button', {
        class: 'btn gray small', type: 'button', text: item.name, 'aria-label': item.name,
        style: { minHeight: '48px', touchAction: 'none', fontSize: 'calc(16px * var(--t))' },
      });
      button.addEventListener('click', () => pick(index), { signal: controls.signal });
      button.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || stored[index] || complete) return;
        pick(index);
        button.setPointerCapture(event.pointerId);
      }, { signal: controls.signal });
      button.addEventListener('pointerup', (event) => {
        const box = action.getBoundingClientRect();
        if (event.clientX >= box.left && event.clientX <= box.right &&
            event.clientY >= box.top && event.clientY <= box.bottom) putAway();
      }, { signal: controls.signal });
      grid.append(button);
      return button;
    });
    const available = () => !document.hidden && !svc.ui.root.querySelector('.screen.dim');
    function render() {
      buttons.forEach((button, index) => {
        button.disabled = stored[index] || complete;
        button.textContent = stored[index] ? '✓ ' + equipment[index].name : equipment[index].name;
        button.setAttribute('aria-pressed', String(index === selected && !stored[index]));
        button.style.outline = index === selected && !stored[index] ? '3px solid #d99c18' : 'none';
      });
      const mesh = meshes[held ?? selected];
      ring.position.set(mesh.position.x, 0.08, mesh.position.z);
      ring.visible = !complete;
      action.textContent = held === null ? '🤲 무기 집기' : '📦 창고에 놓기';
      action.disabled = complete;
      info.textContent = complete ? '가족의 준비가 끝났어요! 🎉' : '📦 ' + count + ' / 6개 정리했어요';
    }
    function pick(index: number) {
      if (complete || !available() || stored[index]) return;
      selected = index;
      if (held === index) return;
      if (held !== null && held !== index) {
        meshes[held].position.set((held % 3 - 1) * 1.7, 0.4, held < 3 ? -1.4 : 0.6);
      }
      held = index;
      meshes[index].position.set(0, 1.6, 0.8);
      hint.textContent = '집었어요! 창고에 놓아요.';
      svc.audio.sfx('pickup');
      render();
    }
    function putAway() {
      if (held === null || complete || !available()) return;
      const index = held;
      stored[index] = true;
      meshes[index].position.set((count % 3 - 1) * 0.32, 0.85, 2.7 + Math.floor(count / 3) * 0.2);
      meshes[index].scale.setScalar(0.3);
      held = null;
      count++;
      selected = stored.findIndex((value) => !value);
      if (selected < 0) selected = index;
      hint.textContent = '좋아요! 다음 준비물을 골라요.';
      svc.audio.sfx('rope');
      if (count === 6) {
        complete = true;
        hint.textContent = '함께 정리하니 금방 끝났네요!';
        svc.audio.sfx('victory');
        stage.fx.burst(new Vector3(at.x, displayHeight + 1.5, at.z + 2.7), '#ffe066', 25, 4, 3);
        resultTimer = setTimeout(() => finish?.(), 1000);
      }
      render();
    }
    function changeSelection(direction: number) {
      if (complete || held !== null || !available()) return;
      do { selected = (selected + direction + 6) % 6; } while (stored[selected]);
      svc.audio.sfx('ui_click');
      render();
    }
    const choose = () => held === null ? pick(selected) : putAway();
    action.addEventListener('click', choose, { signal: controls.signal });
    card.querySelector('[aria-label="이전 무기"]')?.addEventListener('click', () => changeSelection(-1), { signal: controls.signal });
    card.querySelector('[aria-label="다음 무기"]')?.addEventListener('click', () => changeSelection(1), { signal: controls.signal });
    window.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code) || !available()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (event.code === 'Space') choose();
      else changeSelection(event.code === 'ArrowLeft' ? -1 : 1);
    }, { capture: true, signal: controls.signal });
    render();
    action.focus();
    await new Promise<void>((resolve) => {
      finish = resolve;
      if (controls.signal.aborted) resolve();
      else controls.signal.addEventListener('abort', () => resolve(), { once: true });
    });
  } finally {
    controls.abort();
    if (resultTimer) clearTimeout(resultTimer);
    panel?.remove();
    objects.removeFromParent();
    ringGeometry.dispose();
    ringMaterial.dispose();
    boardGeometry.dispose();
    boardMaterial.dispose();
    stage.cinematic = previousCamera;
    stage.unblock();
  }
}
