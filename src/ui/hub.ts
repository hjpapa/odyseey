/**
 * 바다 지도 화면 — 섬을 고르고(◀ ▶ · 화살표 · 섬 누르기), 그 섬의 장을 하거나 다시 한다.
 * 3D 장면(HubStage)은 game.ts 가 만들고, 이 화면은 고르기·버튼만 맡는다.
 */
import type { ChapterId, IslandId } from '../types/contracts';
import type { ChapterState, Finds } from '../game/progress';
import { h } from './dom';

export type HubChoice = { type: 'play'; id: ChapterId } | { type: 'title' } | { type: 'ending' };

export interface HubIslandView {
  id: IslandId;
  name: string;
  memory: boolean;
  state: ChapterState;
  chapters: { id: ChapterId; no: number; title: string; childText: string; state: ChapterState }[];
  finds: Finds;
}

export interface HubOptions {
  islands: HubIslandView[];
  start: IslandId;
  done: number;
  total: number;
  endingUnlocked: boolean;
  /** 섬을 바꿀 때 (배가 움직인다) */
  onSelect(id: IslandId): void;
  /** 화면 좌표(-1~1)로 섬 찾기 */
  pick(ndcX: number, ndcY: number): IslandId | null;
  canvas: HTMLElement;
  sfx(id: 'ui_click' | 'sail'): void;
}

const STATE_CHIP: Record<ChapterState, string> = { done: '✅ 끝냄', next: '⭐ 다음 모험', locked: '🔒 아직' };

export function openHub(root: HTMLElement, opts: HubOptions): Promise<HubChoice> {
  return new Promise((resolve) => {
    const life = new AbortController();
    const { signal } = life;
    let index = Math.max(0, opts.islands.findIndex((i) => i.id === opts.start));

    const finish = (c: HubChoice) => {
      life.abort();
      el.remove();
      resolve(c);
    };

    const homeBtn = h('button', { class: 'btn gray small', type: 'button', text: '🏠 처음 화면', onclick: () => finish({ type: 'title' }) });
    const top = h('div', { class: 'hub-top' },
      h('strong', { text: '🗺️ 에게해 지도' }),
      h('span', { class: 'hub-count', text: `끝낸 장 ${opts.done} / ${opts.total}` }),
      homeBtn);
    const prev = h('button', { class: 'btn blue small hub-arrow', type: 'button', text: '◀', 'aria-label': '이전 섬' });
    const next = h('button', { class: 'btn blue small hub-arrow', type: 'button', text: '▶', 'aria-label': '다음 섬' });
    const name = h('h2', { class: 'hub-name' });
    const list = h('div', { class: 'hub-chapters' });
    const finds = h('div', { class: 'hub-finds' });
    const ending = opts.endingUnlocked
      ? h('button', { class: 'btn gold small', type: 'button', text: '🎬 엔딩 다시 보기', onclick: () => finish({ type: 'ending' }) })
      : null;
    const panel = h('div', { class: 'hub-panel', role: 'region', 'aria-label': '섬 정보' },
      h('div', { class: 'hub-nav' }, prev, name, next), list, finds, ending);
    const el = h('div', { class: 'hub-ui' }, top, panel);
    root.append(el);

    const playable = (s: ChapterState) => s !== 'locked';
    let primary: HTMLButtonElement | null = null;

    const render = (focusPrimary: boolean) => {
      const isl = opts.islands[index];
      const mark = isl.state === 'done' ? '✅' : isl.state === 'next' ? '⭐' : '🔒';
      name.textContent = `${mark} ${isl.name}${isl.memory ? ' · 회상' : ''}`;
      primary = null;
      list.replaceChildren(...isl.chapters.map((c) => {
        const btn = h('button', {
          class: `btn small ${c.state === 'next' ? 'gold' : c.state === 'done' ? '' : 'gray'}`,
          type: 'button',
          text: c.state === 'next' ? '⛵ 모험하기' : c.state === 'done' ? '↺ 다시 하기' : '🔒',
          disabled: !playable(c.state),
          'aria-label': `${c.no}장 ${c.title} ${c.state === 'locked' ? '잠김' : '시작'}`,
          onclick: () => finish({ type: 'play', id: c.id }),
        }) as HTMLButtonElement;
        if (playable(c.state) && (!primary || c.state === 'next')) primary = btn;
        return h('div', { class: `hub-ch ${c.state}` },
          h('div', { class: 'hub-ch-head' },
            h('span', { class: 'hub-chip', text: STATE_CHIP[c.state] }),
            h('b', { text: `${c.no}장 「${c.title}」` })),
          c.state === 'locked'
            ? h('p', { class: 'hub-child locked', text: '앞의 장을 끝내면 열려요.' })
            : h('p', { class: 'hub-child', text: `“${c.childText}”` }),
          btn);
      }));
      const f = isl.finds;
      const parts = [
        f.chestTotal ? `📦 보물상자 ${f.chests}/${f.chestTotal}` : '',
        f.shrineTotal ? `🦉 부엉이 신전 ${f.shrines}/${f.shrineTotal}` : '',
      ].filter(Boolean);
      finds.textContent = parts.join(' · ');
      finds.hidden = parts.length === 0;
      prev.disabled = index === 0;
      next.disabled = index === opts.islands.length - 1;
      if (focusPrimary) (primary ?? next).focus();
    };

    const go = (to: number) => {
      const i = Math.max(0, Math.min(opts.islands.length - 1, to));
      if (i === index) return;
      index = i;
      opts.sfx('sail');
      opts.onSelect(opts.islands[index].id);
      render(true);
    };

    prev.addEventListener('click', () => go(index - 1), { signal });
    next.addEventListener('click', () => go(index + 1), { signal });

    // 섬 누르기 (끌지 않고 톡 누른 경우만)
    let down: { x: number; y: number } | null = null;
    opts.canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; }, { signal });
    opts.canvas.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) return;
      down = null;
      const r = opts.canvas.getBoundingClientRect();
      const id = opts.pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const i = id ? opts.islands.findIndex((x) => x.id === id) : -1;
      if (i >= 0) go(i);
    }, { signal });

    window.addEventListener('keydown', (e) => {
      if (document.querySelector('.screen.dim')) return;
      const onButton = (e.target as HTMLElement | null)?.tagName === 'BUTTON' && el.contains(e.target as Node);
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        go(index - 1);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        go(index + 1);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        finish({ type: 'title' });
      } else if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') && !onButton) {
        e.preventDefault();
        primary?.click();
      }
    }, { capture: true, signal });

    render(true);
  });
}
