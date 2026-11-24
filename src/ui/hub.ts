/**
 * 바다 지도 화면 — 섬을 고르고(◀ ▶ · 화살표 · 섬 누르기), 그 섬의 장을 하거나 다시 한다.
 * 3D 장면(HubStage)은 game.ts 가 만들고, 이 화면은 고르기·버튼만 맡는다.
 */
import type { ChapterId, IslandId } from '../types/contracts';
import type { ChapterState, Finds } from '../game/progress';
import { h } from './dom';
import { ODYSSEY_SIDE_STORIES, sideStoriesAt, sideStoryUnlocked, type OdysseySideStory } from '../story/sideStories';

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

let storyDialogId = 0;

const STATE_CHIP: Record<ChapterState, string> = { done: '✅ 끝냄', next: '⭐ 다음 모험', locked: '🔒 아직' };

export function openHub(root: HTMLElement, opts: HubOptions): Promise<HubChoice> {
  return new Promise((resolve) => {
    const life = new AbortController();
    const { signal } = life;
    let index = Math.max(0, opts.islands.findIndex((i) => i.id === opts.start));
    const completed = opts.islands.flatMap((island) => island.chapters.filter((chapter) => chapter.state === 'done').map((chapter) => chapter.id));
    const readyStories = ODYSSEY_SIDE_STORIES.filter((story) => sideStoryUnlocked(story, completed)).length;
    let storyLayer: HTMLDivElement | null = null;
    let storyOpener: HTMLElement | null = null;
    let closed = false;

    const finish = (c: HubChoice) => {
      if (closed) return;
      closed = true;
      closeStory(false);
      life.abort();
      el.remove();
      resolve(c);
    };

    const homeBtn = h('button', { class: 'btn gray small', type: 'button', text: '🏠 처음 화면', onclick: () => finish({ type: 'title' }) });
    const top = h('div', { class: 'hub-top' },
      h('strong', { text: '🗺️ 에게해 지도' }),
      h('span', { class: 'hub-count', text: `끝낸 장 ${opts.done} / ${opts.total}` }),
      homeBtn);
    const route = h('nav', { class: 'hub-route', 'aria-label': '이야기 순서대로 섬 고르기' });
    const mast = h('div', { class: 'hub-mast' }, top, route,
      h('p', { class: 'hub-legend', text: '✅ 지난 모험 · ⭐ 다음 모험 · 📜 원작 곁이야기 ' + readyStories + ' / ' + ODYSSEY_SIDE_STORIES.length }));
    const prev = h('button', { class: 'btn blue small hub-arrow', type: 'button', text: '◀', 'aria-label': '이전 섬' });
    const next = h('button', { class: 'btn blue small hub-arrow', type: 'button', text: '▶', 'aria-label': '다음 섬' });
    const name = h('h2', { class: 'hub-name' });
    const list = h('div', { class: 'hub-chapters' });
    const finds = h('div', { class: 'hub-finds' });
    const sideStories = h('section', { class: 'hub-side-stories', 'aria-label': '선택해서 읽는 원작 곁이야기' });
    const ending = opts.endingUnlocked
      ? h('button', { class: 'btn gold small', type: 'button', text: '🎬 엔딩 다시 보기', onclick: () => finish({ type: 'ending' }) })
      : null;
    const panel = h('div', { class: 'hub-panel', role: 'region', 'aria-label': '섬 정보' },
      h('div', { class: 'hub-nav' }, prev, name, next), list, finds, sideStories, ending);
    const el = h('div', { class: 'hub-ui' }, mast, panel);
    root.append(el);

    const playable = (s: ChapterState) => s !== 'locked';
    let primary: HTMLButtonElement | null = null;

    function closeStory(restoreFocus = true) {
      storyLayer?.remove();
      storyLayer = null;
      mast.inert = false;
      panel.inert = false;
      if (restoreFocus && storyOpener?.isConnected) storyOpener.focus({ preventScroll: true });
      storyOpener = null;
    }

    function openStory(story: OdysseySideStory) {
      if (closed || storyLayer || !sideStoryUnlocked(story, completed)) return;
      storyOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const titleId = 'hub-side-story-' + ++storyDialogId;
      const close = h('button', { class: 'btn gold', type: 'button', text: '🗺️ 지도로 돌아가기', onclick: () => closeStory() });
      const dismiss = h('button', { class: 'hub-story-close', type: 'button', text: '✕', 'aria-label': '곁이야기 닫기', onclick: () => closeStory() });
      storyLayer = h('div', {
        class: 'screen dim hub-story-layer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId,
      }, h('article', { class: 'hub-story-reader' },
        h('div', { class: 'hub-story-top' }, h('p', { class: 'hub-story-kicker', text: '선택해서 읽는 이야기 · 호메로스 원작' }), dismiss),
        h('div', { class: 'hub-story-emoji', text: story.emoji, 'aria-hidden': 'true' }),
        h('h2', { id: titleId, text: story.title }),
        h('p', { class: 'hub-story-place', text: story.place }),
        ...story.paragraphs.map((text) => h('p', { class: 'hub-story-text', text })),
        h('p', { class: 'hub-story-reflect', text: '💭 ' + story.reflect }),
        h('p', { class: 'hub-story-note', text: '원작의 한 장면을 쉬운 말로 다시 썼어요.' }),
        h('a', { class: 'hub-story-source', href: story.source.url, target: '_blank', rel: 'noopener noreferrer',
          text: '출처 · 호메로스 『오디세이아』 ' + story.source.passage + ' · Samuel Butler 번역 ↗' }),
        close));
      mast.inert = true;
      panel.inert = true;
      root.append(storyLayer);
      opts.sfx('ui_click');
      dismiss.focus({ preventScroll: true });
    }

    const render = (focusPrimary: boolean, focusRoute = false) => {
      const isl = opts.islands[index];
      const mark = isl.state === 'done' ? '✅' : isl.state === 'next' ? '⭐' : '🔒';
      name.textContent = `${mark} ${isl.name}${isl.memory ? ' · 회상' : ''}`;
      primary = null;
      route.replaceChildren(...opts.islands.map((island, position) => {
        const first = island.chapters[0]?.no ?? position + 1;
        const last = island.chapters[island.chapters.length - 1]?.no ?? first;
        const count = sideStoriesAt(island.id).filter((story) => sideStoryUnlocked(story, completed)).length;
        return h('button', {
          class: 'hub-route-stop ' + island.state + (position === index ? ' selected' : ''),
          type: 'button', 'aria-current': position === index ? 'location' : undefined,
          'aria-label': island.name + ' ' + first + (last !== first ? '에서 ' + last : '') + '장' + (count ? ', 원작 곁이야기 ' + count + '편' : ''),
          onclick: () => go(position, true),
        }, h('span', { class: 'hub-route-number', text: (island.state === 'done' ? '✓ ' : island.state === 'next' ? '⭐ ' : '🔒 ') + first + (last !== first ? '–' + last : '') }),
        h('span', { class: 'hub-route-name', text: island.name }),
        count ? h('span', { class: 'hub-route-story', text: '📜 ' + count }) : null);
      }));
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
      const stories = sideStoriesAt(isl.id);
      sideStories.hidden = stories.length === 0;
      sideStories.replaceChildren(
        h('h3', { text: '📜 원작 곁이야기', class: 'hub-side-title' }),
        h('p', { text: '궁금한 장면을 골라 읽어요.', class: 'hub-side-intro' }),
        ...stories.map((story) => {
          const unlocked = sideStoryUnlocked(story, completed);
          return h('button', {
            class: 'hub-side-story' + (unlocked ? '' : ' locked'), type: 'button', disabled: !unlocked,
            'data-story': story.id, onclick: () => openStory(story),
          }, h('span', { text: unlocked ? story.emoji : '🔒', 'aria-hidden': 'true' }),
          h('span', { text: unlocked ? story.title : Number(story.unlockAfter.slice(2)) + '장을 마치면 열려요.' }),
          h('span', { text: unlocked ? '읽기 ›' : '곧 만나요', class: 'hub-side-action' }));
        }));
      prev.disabled = index === 0;
      next.disabled = index === opts.islands.length - 1;
      if (focusRoute) {
        const selected = route.querySelector<HTMLButtonElement>('[aria-current]');
        selected?.focus({ preventScroll: true });
        selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } else if (focusPrimary) (primary ?? next).focus();
    };

    const go = (to: number, focusRoute = false) => {
      const i = Math.max(0, Math.min(opts.islands.length - 1, to));
      if (i === index) return;
      index = i;
      opts.sfx('sail');
      opts.onSelect(opts.islands[index].id);
      render(true, focusRoute);
    };

    prev.addEventListener('click', () => go(index - 1), { signal });
    next.addEventListener('click', () => go(index + 1), { signal });

    // 섬 누르기 (끌지 않고 톡 누른 경우만)
    let down: { x: number; y: number } | null = null;
    opts.canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; }, { signal });
    opts.canvas.addEventListener('pointerup', (e) => {
      if (storyLayer || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) return;
      down = null;
      const r = opts.canvas.getBoundingClientRect();
      const id = opts.pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const i = id ? opts.islands.findIndex((x) => x.id === id) : -1;
      if (i >= 0) go(i);
    }, { signal });

    window.addEventListener('keydown', (e) => {
      if (storyLayer) {
        if (['Escape', 'Tab', 'Space', 'Enter', 'NumpadEnter', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (e.repeat) return;
          if (e.code === 'Escape') closeStory();
          else if (e.code === 'Tab') {
            const choices = [...storyLayer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
            const current = choices.findIndex((choice) => choice === document.activeElement);
            choices[(current + (e.shiftKey ? -1 : 1) + choices.length) % choices.length]?.focus();
          } else if (['Space', 'Enter', 'NumpadEnter'].includes(e.code)) {
            const active = document.activeElement;
            if (active instanceof HTMLElement && storyLayer.contains(active) && active.matches('button, a[href]')) active.click();
          }
        }
        return;
      }
      if (document.querySelector('.screen.dim')) return;
      const onButton = (e.target as HTMLElement | null)?.tagName === 'BUTTON' && el.contains(e.target as Node);
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        go(index - 1, route.contains(e.target as Node));
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        go(index + 1, route.contains(e.target as Node));
      } else if (e.code === 'Escape') {
        e.preventDefault();
        finish({ type: 'title' });
      } else if (['Enter', 'NumpadEnter', 'Space'].includes(e.code)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        if (onButton) (e.target as HTMLButtonElement).click();
        else primary?.click();
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!e.repeat) primary?.click();
      }
    }, { capture: true, signal });

    render(true);
    route.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
}
