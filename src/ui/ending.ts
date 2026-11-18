/**
 * 엔딩 화면들 — 아이가 쓴 17줄을 한 장씩 넘기는 이야기책, 올라가는 크레딧, 모험 성적표.
 * 모두 건너뛸 수 있고, 화면이 가려진 동안에는 저절로 넘어가지 않는다.
 */
import type { CreditLine } from '../story/credits';
import type { Finds, SubjectScore } from '../game/progress';
import { prefs } from '../game/prefs';
import { formatPlayTime } from '../game/progress';
import { h } from './dom';

export interface StoryPage {
  no: number;
  title: string;
  text: string;
  emoji: string;
}

/** 화면이 보일 때만 흐르는 타이머 — 다 차면 done() */
function visibleTimer(ms: number, tick: (left: number) => void, done: () => void, signal: AbortSignal) {
  let left = ms;
  let last = performance.now();
  const id = setInterval(() => {
    const now = performance.now();
    if (!document.hidden) left -= now - last;
    last = now;
    tick(left);
    if (left <= 0) {
      clearInterval(id);
      done();
    }
  }, 100);
  signal.addEventListener('abort', () => clearInterval(id), { once: true });
}

/** 이야기책: 한 장씩 저절로 넘어가고, 누르거나 Space·Enter·→ 로 넘길 수 있다 */
export function storybook(root: HTMLElement, pages: StoryPage[], opts: { pageMs: number; onPage?(i: number): void }): Promise<void> {
  return new Promise((resolve) => {
    const life = new AbortController();
    let i = -1;
    let timer: AbortController | null = null;

    const emoji = h('div', { class: 'book-emoji', 'aria-hidden': 'true' });
    const no = h('div', { class: 'book-no' });
    const text = h('p', { class: 'book-text' });
    const bar = h('div', { class: 'book-bar' });
    const skip = h('button', { class: 'btn gray small', type: 'button', text: '건너뛰기 ⏭' });
    const nextBtn = h('button', { class: 'btn small', type: 'button', text: '다음 ▶' });
    const page = h('div', { class: 'book-page', role: 'group', 'aria-roledescription': '이야기책', 'aria-live': 'polite' }, emoji, no, text, bar);
    const el = h('div', { class: 'screen clear book' },
      h('div', { class: 'book-head', text: '📖 아이가 쓴 17장의 이야기' }),
      page,
      h('div', { class: 'row' }, skip, nextBtn));
    root.append(el);

    const end = () => {
      timer?.abort();
      life.abort();
      el.remove();
      resolve();
    };
    const turn = () => {
      i++;
      if (i >= pages.length) {
        end();
        return;
      }
      const p = pages[i];
      emoji.textContent = p.emoji;
      no.textContent = `${p.no}장 · ${p.title}`;
      text.textContent = p.text;
      page.classList.remove('turn');
      void page.offsetWidth;
      page.classList.add('turn');
      nextBtn.textContent = i === pages.length - 1 ? '끝 ▶' : '다음 ▶';
      opts.onPage?.(i);
      timer?.abort();
      timer = new AbortController();
      visibleTimer(opts.pageMs, (left) => { bar.style.width = `${Math.max(0, Math.min(100, 100 - (left / opts.pageMs) * 100))}%`; }, turn, timer.signal);
    };

    skip.addEventListener('click', end, { signal: life.signal });
    nextBtn.addEventListener('click', turn, { signal: life.signal });
    page.addEventListener('click', turn, { signal: life.signal });
    window.addEventListener('keydown', (e) => {
      if (document.querySelector('.screen.dim')) return;
      if (['Space', 'Enter', 'ArrowRight', 'KeyE'].includes(e.code)) {
        if ((e.target as HTMLElement | null)?.tagName === 'BUTTON' && el.contains(e.target as Node) && e.code !== 'ArrowRight') return;
        e.preventDefault();
        if (!e.repeat) turn();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        end();
      }
    }, { capture: true, signal: life.signal });

    nextBtn.focus();
    turn();
  });
}

/** 아래에서 위로 올라가는 크레딧 */
export function creditsRoll(root: HTMLElement, lines: CreditLine[], opts: { ms: number }): Promise<void> {
  return new Promise((resolve) => {
    const life = new AbortController();
    const roll = h('div', { class: 'credits-roll' },
      ...lines.map((l) => h('div', { class: `credit ${l.role ? '' : 'big'}` },
        l.role ? h('div', { class: 'credit-role', text: l.role }) : null,
        h('div', { class: 'credit-text', text: l.text }))));
    // '번쩍임·흔들림 줄이기'를 켜면 움직이지 않는 목록으로 보여 주고 버튼으로 넘어간다
    const still = prefs.calm;
    roll.style.setProperty('--roll', `${opts.ms}ms`);
    const skip = h('button', { class: 'btn gray small credits-skip', type: 'button', text: still ? '다음 ▶' : '건너뛰기 ⏭' });
    const el = h('div', { class: `screen clear credits${still ? ' still' : ''}` }, roll, skip);
    root.append(el);
    const end = () => {
      life.abort();
      el.remove();
      resolve();
    };
    // 화면이 가려지면 멈췄다가 돌아오면 이어서 흐른다
    document.addEventListener('visibilitychange', () => {
      roll.style.animationPlayState = document.hidden ? 'paused' : 'running';
    }, { signal: life.signal });
    if (!still) roll.addEventListener('animationend', end, { signal: life.signal });
    skip.addEventListener('click', end, { signal: life.signal });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || ((e.code === 'Space' || e.code === 'Enter') && e.target !== skip)) {
        e.preventDefault();
        end();
      }
    }, { capture: true, signal: life.signal });
    skip.focus();
  });
}

export interface EndingReport {
  playSeconds: number;
  coins: number;
  chapters: number;
  totalChapters: number;
  subjects: SubjectScore[];
  finds: Finds;
}

/** 모험 성적표 — 지도로 갈지, 처음 화면으로 갈지 */
export function reportCard(root: HTMLElement, r: EndingReport): Promise<'map' | 'title'> {
  return new Promise((resolve) => {
    const done = (v: 'map' | 'title') => {
      el.remove();
      resolve(v);
    };
    const asked = r.subjects.reduce((n, s) => n + s.total, 0);
    const rows = r.subjects.filter((s) => s.total > 0).map((s) =>
      h('div', { class: 'report-row' },
        h('span', { text: s.label }),
        h('span', { class: 'report-bar' }, h('i', { style: { width: `${Math.round((s.firstTry / s.total) * 100)}%` } })),
        h('b', { text: `${s.firstTry} / ${s.total}` })));
    const mapBtn = h('button', { class: 'btn', type: 'button', text: '🗺️ 지도로', onclick: () => done('map') });
    const el = h('div', { class: 'screen dim' },
      h('div', { class: 'card report' },
        h('div', { class: 'big-emoji', text: '🏆' }),
        h('h2', { text: '오디세우스의 모험 완료!' }),
        h('p', { text: `⏱️ 함께 모험한 시간 ${formatPlayTime(r.playSeconds)}` }),
        h('p', { text: `📖 이야기 ${r.chapters} / ${r.totalChapters}장 · 🫒 올리브잎 ${r.coins}개` }),
        h('p', { text: `📦 보물상자 ${r.finds.chests} / ${r.finds.chestTotal} · 🦉 부엉이 신전 ${r.finds.shrines} / ${r.finds.shrineTotal}` }),
        asked > 0 ? h('p', { class: 'report-sub', text: '🦉 한 번에 맞힌 문제' }) : null,
        ...rows,
        h('div', { class: 'row' }, h('button', { class: 'btn gray', type: 'button', text: '🏠 처음 화면', onclick: () => done('title') }), mapBtn)));
    root.append(el);
    mapBtn.focus();
  });
}
