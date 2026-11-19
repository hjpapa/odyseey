import { BoxGeometry, Group, Mesh, MeshToonMaterial, SphereGeometry, Vector3, type Object3D } from 'three';
import type { IslandStage } from '../../game/islandStage';
import type { AskResult } from '../../types/contracts';
import { getModel } from '../../core/models';
import { mannersScenes } from '../../learning/data';
import { h, linked } from '../../ui/dom';
import { makeProp } from '../../world/props';

/** 가족의 잔치에서 서로 다른 식사 예절 세 가지를 배우고 학습 기록에도 남긴다. */
export async function feast(stage: IslandStage, at: Vector3): Promise<void> {
  if (stage.signal.aborted) return;
  const { svc, world } = stage;
  const controls = linked(stage.signal);
  const previousCamera = stage.cinematic;
  const previousVisibility = stage.player.root.visible;
  const objects = new Group();
  const hiddenFamily: { object: Object3D; visible: boolean }[] = [];
  const box = new BoxGeometry(1, 1, 1);
  const grape = new SphereGeometry(0.12, 8, 6);
  const wood = new MeshToonMaterial({ color: '#9c6b3c' });
  const cloth = new MeshToonMaterial({ color: '#fff3d4' });
  const purple = new MeshToonMaterial({ color: '#a46acc' });
  const bread = new MeshToonMaterial({ color: '#e6b36a' });
  let panel: HTMLElement | undefined;
  let resultTimer: ReturnType<typeof setTimeout> | undefined;
  let ownedQuiz: Element | null = null;
  let start: (() => void) | undefined;
  let started = false;
  stage.block();
  try {
    const ground = world.ground(at.x, at.z);
    // 잔치의 가족 모형과 원래 궁전 NPC가 나란히 중복해서 보이지 않게 한다.
    for (const npc of stage.layout.npcs.filter((npc) => npc.model === 'penelope' || npc.model === 'telemachus')) {
      const actor = stage.scene.children.find((object) =>
        object.position.x === npc.pos[0] && object.position.z === npc.pos[1] &&
        object.children.some((child) => child.userData.modelId === npc.model));
      if (actor) {
        hiddenFamily.push({ object: actor, visible: actor.visible });
        actor.visible = false;
      }
    }
    objects.position.set(at.x, ground, at.z);
    const table = new Mesh(box, cloth);
    table.scale.set(3.4, 0.22, 2);
    table.position.y = 1.2;
    objects.add(table);
    for (const x of [-1.3, 1.3]) {
      for (const z of [-0.65, 0.65]) {
        const leg = new Mesh(box, wood);
        leg.scale.set(0.18, 1.1, 0.18);
        leg.position.set(x, 0.55, z);
        objects.add(leg);
      }
    }
    for (let i = 0; i < 9; i++) {
      const fruit = new Mesh(grape, purple);
      fruit.position.set(-0.9 + (i % 3) * 0.19, 1.45 + Math.floor(i / 6) * 0.15, -0.3 + Math.floor(i / 3) * 0.16);
      objects.add(fruit);
    }
    const loaf = new Mesh(box, bread);
    loaf.scale.set(0.65, 0.2, 0.38);
    loaf.position.set(0.4, 1.45, -0.2);
    objects.add(loaf);
    const jug = makeProp('amphora');
    jug.scale.setScalar(0.6);
    jug.position.set(1.1, 1.3, 0.25);
    objects.add(jug);
    const family = [
      { id: 'odysseus', x: -2.2, z: -0.4 },
      { id: 'penelope', x: 2.2, z: -0.4 },
      { id: 'telemachus', x: 0, z: 2.1 },
    ] as const;
    for (const person of family) {
      const model = getModel(person.id);
      model.scale.setScalar(0.8);
      model.position.set(person.x, 0, person.z);
      model.rotation.y = Math.atan2(-person.x, -person.z);
      objects.add(model);
    }
    stage.scene.add(objects);
    stage.player.root.visible = false;
    stage.cinematic = {
      pos: new Vector3(at.x + 6.5, ground + 7, at.z - 8),
      look: new Vector3(at.x, ground + 1.2, at.z),
    };

    const info = h('div', { class: 'info', text: '🍇 가족과 함께하는 잔치', role: 'status', 'aria-live': 'polite',
      style: { fontSize: 'calc(clamp(17px, 4vw, 22px) * var(--t))', maxWidth: '90vw', textAlign: 'center' } });
    const startButton = h('button', { class: 'btn gold', type: 'button', text: '🍽️ 잔치 시작' });
    const guide = h('div', {
      text: '식사 예절 세 가지 · ← → 고르기 · Space 선택',
      style: { background: '#fff8ee', padding: '8px 12px', borderRadius: '12px', maxWidth: '90vw', textAlign: 'center', fontSize: 'calc(16px * var(--t))' },
    });
    panel = h('div', { class: 'mini-panel', 'data-minigame': 'feast', role: 'group', 'aria-label': '가족 잔치' }, info, guide, startButton);
    svc.ui.root.append(panel);
    let selected = 0;
    let lastCard: Element | null = null;
    const available = () => !document.hidden && !svc.ui.root.querySelector('.screen.dim');
    const begin = () => {
      if (started || !available()) return;
      started = true;
      svc.audio.sfx('ui_click');
      start?.();
    };
    startButton.addEventListener('click', begin, { signal: controls.signal });
    window.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code) || !available()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (!started) {
        if (event.code === 'Space') begin();
        return;
      }
      const card = svc.ui.root.querySelector('.quiz-card');
      if (!card) return;
      if (card !== lastCard) {
        lastCard = card;
        selected = 0;
      }
      const next = card.querySelector<HTMLButtonElement>('.quiz-next button');
      if (next) {
        if (event.code === 'Space') next.click();
        return;
      }
      const answers = Array.from(card.querySelectorAll<HTMLButtonElement>('.quiz-answers button.answer'));
      if (!answers.length) return;
      if (event.code === 'Space') {
        answers[selected]?.click();
      } else {
        selected = (selected + (event.code === 'ArrowLeft' ? -1 : 1) + answers.length) % answers.length;
        answers[selected].focus();
        svc.audio.sfx('ui_click');
      }
    }, { capture: true, signal: controls.signal });
    startButton.focus();
    const began = await new Promise<boolean>((resolve) => {
      start = () => resolve(true);
      if (controls.signal.aborted) resolve(false);
      else controls.signal.addEventListener('abort', () => resolve(false), { once: true });
    });
    if (!began || controls.signal.aborted) return;
    startButton.remove();
    guide.textContent = '아테와 함께 골라요. 틀려도 다시 생각하면 돼요!';
    const grade = svc.save.data?.grade ?? 1;
    const tableScenes = mannersScenes.filter((scene) => scene.category === 'table');
    const situations = [
      ...tableScenes.filter((scene) => scene.grade <= grade),
      ...tableScenes.filter((scene) => scene.grade > grade),
    ].slice(0, 3);
    const cancelled = new Promise<undefined>((resolve) => {
      if (controls.signal.aborted) resolve(undefined);
      else controls.signal.addEventListener('abort', () => resolve(undefined), { once: true });
    });
    for (let index = 0; index < 3; index++) {
      if (controls.signal.aborted) return;
      info.textContent = '🍽️ 식사 예절 ' + (index + 1) + ' / 3';
      // 이미 이 미니게임이 입력을 잠갔다. 학습 API를 직접 써서 중단 시에도 잠금을 한 번에 되돌린다.
      const pending = svc.learning.ask({
        reason: 'story',
        slot: {
          id: 'feast-table-' + (index + 1), subject: 'manners', placement: 'story', count: 1,
          topic: 'table', ids: situations[index] ? [situations[index].id] : undefined,
        },
      });
      const firstAnswer = svc.ui.root.querySelector<HTMLButtonElement>('.quiz-card .quiz-answers button.answer');
      ownedQuiz = svc.ui.root.querySelector('.quiz-card');
      firstAnswer?.focus();
      const result: AskResult | undefined = await Promise.race([pending, cancelled]);
      if (!result || controls.signal.aborted) return;
      ownedQuiz = null;
      stage.asked += result.questionIds.length;
      stage.firstTry += result.firstTry;
    }
    info.textContent = '🎉 서로를 아끼는 따뜻한 잔치!';
    guide.textContent = '함께 먹으니 더 맛있어요. 고맙습니다!';
    svc.audio.sfx('victory');
    stage.fx.burst(new Vector3(at.x, ground + 2, at.z), '#ffe066', 36, 5, 4);
    await new Promise<void>((resolve) => {
      resultTimer = setTimeout(resolve, 1200);
      if (controls.signal.aborted) resolve();
      else controls.signal.addEventListener('abort', () => resolve(), { once: true });
    });
  } finally {
    if (stage.signal.aborted && ownedQuiz?.isConnected) {
      const cards = svc.ui.root.querySelectorAll('.quiz-card');
      if (cards.length === 1 && cards[0] === ownedQuiz) svc.ui.quiz.abortAll();
    }
    controls.abort();
    if (resultTimer) clearTimeout(resultTimer);
    panel?.remove();
    objects.removeFromParent();
    box.dispose();
    grape.dispose();
    wood.dispose();
    cloth.dispose();
    purple.dispose();
    bread.dispose();
    stage.cinematic = previousCamera;
    stage.player.root.visible = previousVisibility;
    hiddenFamily.forEach(({ object, visible }) => { object.visible = visible; });
    stage.unblock();
  }
}
