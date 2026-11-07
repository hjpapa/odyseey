/** 대화창·자막·장 시작 카드 */
import type { ChapterData, Emote, SpeakerId } from '../types/contracts';
import { SPEAKERS } from '../story/speakers';
import { h, linked, sleep, waitAdvance } from './dom';

const CHARS_PER_SEC = 30;

export class DialogueUI {
  private ac = new AbortController();
  /** 개발용: 대사를 기다리지 않고 바로 넘긴다 */
  fast = false;

  constructor(private root: HTMLElement, private onBlip?: () => void) {}

  /** 열려 있는 대화를 모두 닫는다 (기다리던 쪽은 더 진행되지 않음) */
  abortAll() {
    this.ac.abort();
    this.ac = new AbortController();
    this.root.querySelectorAll('.dialogue-layer, .caption, .titlecard').forEach((el) => el.remove());
  }

  /** 대사 한 줄: 글자가 하나씩 나오고, 탭하면 다음으로 */
  async line(speaker: SpeakerId, text: string, _emote?: Emote): Promise<void> {
    if (this.fast) return sleep(20);
    const signal = this.ac.signal;
    const info = SPEAKERS[speaker] ?? SPEAKERS.narrator;
    const textEl = h('p', { class: 'text' });
    const more = h('span', { class: 'more', text: '▼' });
    more.style.visibility = 'hidden';
    const who = h('div', { class: 'who', style: { background: info.color } }, h('span', { class: 'icon', text: info.icon }), info.name);
    const box = h('div', { class: 'dialogue' }, speaker === 'narrator' ? null : who, textEl, more);
    const layer = h('div', { class: 'dialogue-layer' }, box);
    this.root.append(layer);
    this.onBlip?.();

    // 글자 하나씩 — 탭하면 바로 전부 보이기
    const chars = [...text];
    let shown = 0;
    let skip = false;
    const typing = linked(signal);
    layer.addEventListener('pointerdown', () => (skip = true), { signal: typing.signal });
    window.addEventListener('keydown', (e) => {
      if (['Space', 'Enter', 'KeyE', 'KeyJ'].includes(e.code)) skip = true;
    }, { signal: typing.signal });
    const start = performance.now();
    while (shown < chars.length && !skip && !signal.aborted) {
      await sleep(16);
      shown = Math.min(chars.length, Math.floor(((performance.now() - start) / 1000) * CHARS_PER_SEC));
      textEl.textContent = chars.slice(0, shown).join('');
    }
    typing.abort();
    textEl.textContent = text;
    more.style.visibility = 'visible';
    await waitAdvance(layer, { minMs: 120, signal });
    layer.remove();
  }

  /** 화면 가운데 큰 자막 */
  async caption(text: string): Promise<void> {
    if (this.fast) return sleep(20);
    const signal = this.ac.signal;
    const el = h('div', { class: 'caption' }, h('p', { text }));
    this.root.append(el);
    requestAnimationFrame(() => el.classList.add('show'));
    await waitAdvance(el, { minMs: 900, autoMs: 5200, signal });
    el.classList.remove('show');
    await sleep(450);
    el.remove();
  }

  /** 장 시작 카드 — 아이 원문을 그대로 보여 준다 */
  async titleCard(ch: ChapterData): Promise<void> {
    if (this.fast) return sleep(20);
    const signal = this.ac.signal;
    const start = h('button', { class: 'btn gold', type: 'button', text: '모험 시작! ⚓' });
    const el = h(
      'div',
      { class: 'screen titlecard' },
      h('div', { class: 'no', text: `${ch.no}장` }),
      h('h2', { text: ch.title }),
      h('div', { class: 'child-note' }, h('span', { class: 'label', text: '✏️ 아이가 쓴 이야기' }), h('div', { class: 'text', text: ch.titleCard.childText })),
      h('div', { class: 'subtitle', text: ch.titleCard.subtitle }),
      start,
    );
    this.root.append(el);
    start.focus();
    const local = linked(signal);
    await new Promise<void>((resolve) => {
      const finish = () => {
        if (signal.aborted) return;
        local.abort();
        resolve();
      };
      start.addEventListener('click', finish, { once: true, signal: local.signal });
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          finish();
        }
      }, { capture: true, signal: local.signal });
    });
    el.remove();
  }
}
