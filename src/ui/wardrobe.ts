/**
 * C3 꾸미기 — 사고 입는 규칙과 3D 미리보기는 엔진에 맡기고,
 * 이 화면은 선택·구매 확인·포커스와 짧은 수명의 리스너를 관리한다.
 */
import { WARDROBE_SLOTS, type AvatarCustomization, type OpenWardrobe, type ShopItem, type WardrobeSlot } from '../types/contracts';
import { isOwned, isWorn, wear } from '../game/shop';
import { h } from './dom';

export const WARDROBE_READY: boolean = true;

const SLOTS: Record<WardrobeSlot, { name: string; emoji: string }> = {
  helmet: { name: '투구', emoji: '🪖' },
  tunic: { name: '옷', emoji: '👕' },
  cape: { name: '망토', emoji: '🧣' },
  shield: { name: '방패', emoji: '🛡️' },
};
let instance = 0;

export const openWardrobe: OpenWardrobe = (root, opts) => new Promise<void>((resolve) => {
  const life = new AbortController();
  const prefix = 'wardrobe-' + ++instance;
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const canvas = document.getElementById('scene');
  const previewWasOpen = canvas?.classList.contains('wardrobe-preview') ?? false;
  canvas?.classList.add('wardrobe-preview');
  const titles = [...root.querySelectorAll<HTMLElement>('.title-screen')].map((el) => ({
    el, visibility: el.style.visibility, inert: el.inert, hidden: el.getAttribute('aria-hidden'),
  }));
  for (const { el } of titles) {
    el.style.visibility = 'hidden';
    el.inert = true;
    el.setAttribute('aria-hidden', 'true');
  }

  let coins = opts.coins;
  let avatar: AvatarCustomization = { ...opts.avatar };
  const owned = [...opts.owned];
  const items = new Map(opts.items.map((item) => [item.id, item]));
  let slot: WardrobeSlot = 'helmet';
  const remembered = new Map<WardrobeSlot, string>();
  let pending: ShopItem | null = null;
  let confirmation: HTMLElement | null = null;
  let closed = false;
  let buying = false;

  const balance = h('span', { class: 'wardrobe-balance', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const heading = h('h2', { id: prefix + '-title', text: '모험 꾸미기' });
  const tabs = h('div', { class: 'wardrobe-tabs', role: 'tablist', 'aria-label': '꾸밀 곳' });
  const list = h('div', { class: 'wardrobe-items', id: prefix + '-items', role: 'tabpanel', tabindex: -1 });
  const message = h('p', { class: 'wardrobe-message', role: 'status', 'aria-live': 'polite', text: '골라 입고 모험을 떠나요.' });
  const done = h('button', { class: 'btn gold wardrobe-done', type: 'button', 'data-action': 'close', text: '다 입었어요' });
  const card = h('section', { class: 'wardrobe-card' },
    h('div', { class: 'wardrobe-heading' }, heading, balance),
    tabs, list,
    h('div', { class: 'wardrobe-footer' }, message, done),
    h('p', { class: 'wardrobe-help', text: '← → 고르기 · Space / Enter 입기 · Esc 닫기' }),
  );
  const screen = h('div', {
    class: 'wardrobe-screen', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': heading.id,
  }, card);

  function announce(text: string, wrong = false) {
    message.textContent = text;
    message.classList.toggle('wardrobe-notice', wrong);
  }

  function focusItem(id: string) {
    const button = [...list.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.dataset.item === id);
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function render() {
    balance.textContent = '🫒 ' + coins;
    balance.setAttribute('aria-label', '남은 올리브잎 ' + coins + '개');
    const current = opts.items.filter((item) => item.slot === slot);
    if (!current.some((item) => item.id === remembered.get(slot))) {
      remembered.set(slot, (current.find((item) => isWorn(item, avatar)) ?? current[0])?.id ?? '');
    }
    tabs.replaceChildren(...WARDROBE_SLOTS.map((key) => h('button', {
      class: 'wardrobe-tab', type: 'button', role: 'tab', id: prefix + '-' + key,
      'data-slot': key, 'aria-selected': key === slot ? 'true' : 'false',
      'aria-controls': list.id, tabindex: key === slot ? 0 : -1,
    }, h('span', { 'aria-hidden': 'true', text: SLOTS[key].emoji }), SLOTS[key].name)));
    list.setAttribute('aria-labelledby', prefix + '-' + slot);
    list.replaceChildren(...current.map((item) => {
      const have = isOwned(item, owned);
      const wearing = isWorn(item, avatar);
      const short = !have && coins < item.price;
      const state = wearing ? '입는 중 ✓' : have ? '가진 것' : '🫒 ' + item.price;
      const visual = item.value?.startsWith('#')
        ? h('span', { class: 'wardrobe-swatch', style: { backgroundColor: item.value }, 'aria-hidden': 'true' })
        : h('span', { class: 'wardrobe-emoji', text: item.emoji, 'aria-hidden': 'true' });
      return h('button', {
        class: 'wardrobe-item' + (wearing ? ' wearing' : '') + (short ? ' short' : ''),
        type: 'button', 'data-item': item.id, tabindex: remembered.get(slot) === item.id ? 0 : -1,
        'aria-pressed': wearing ? 'true' : 'false',
        'aria-label': item.name + ', ' + state + (short ? ', 올리브잎을 더 모아 와요' : ''),
      }, visual, h('strong', { class: 'wardrobe-item-name', text: item.name }),
      h('span', { class: 'wardrobe-state', text: state }));
    }));
    if (!current.length) list.append(h('p', { text: '이곳의 물건을 준비하고 있어요.' }));
  }

  function cancelPurchase(restoreFocus = true) {
    const id = pending?.id;
    confirmation?.remove();
    confirmation = null;
    pending = null;
    card.inert = false;
    if (restoreFocus && id) focusItem(id);
  }

  function putOn(item: ShopItem, bought = false) {
    avatar = wear(avatar, item);
    opts.onWear({ ...avatar });
    opts.sfx?.(bought ? 'level_up' : 'ui_click');
    render();
    focusItem(item.id);
    announce(item.name + (bought ? ' 샀어요! 바로 입었어요.' : ' 입었어요!'));
  }

  function selectItem(item: ShopItem) {
    if (pending || closed) return;
    remembered.set(slot, item.id);
    if (isOwned(item, owned)) {
      putOn(item);
      return;
    }
    if (coins < item.price) {
      opts.sfx?.('wrong');
      announce('올리브잎을 더 모아 와요!', true);
      return;
    }
    opts.sfx?.('ui_click');
    pending = item;
    card.inert = true;
    const title = h('h3', { id: prefix + '-question', text: '🫒 ' + item.price + ' 으로 살까요?' });
    const cancel = h('button', { class: 'btn gray', type: 'button', 'data-action': 'cancel', text: '다음에 살래요' });
    const confirm = h('button', { class: 'btn gold', type: 'button', 'data-action': 'buy', text: '네, 살래요!' });
    confirmation = h('div', { class: 'wardrobe-confirm' },
      h('section', { class: 'wardrobe-question', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': title.id },
        h('span', { class: 'wardrobe-emoji', 'aria-hidden': 'true', text: item.emoji }),
        h('p', { class: 'wardrobe-buy-name', text: item.name }), title,
        h('p', { class: 'wardrobe-after', text: '사고 나면 🫒 ' + (coins - item.price) + '개가 남아요.' }),
        h('div', { class: 'wardrobe-choices' }, cancel, confirm)));
    screen.append(confirmation);
    cancel.focus();
  }

  function purchase() {
    if (!pending || buying || closed) return;
    buying = true;
    const item = pending;
    try {
      const remaining = opts.onBuy(item);
      cancelPurchase(false);
      if (remaining === null) {
        opts.sfx?.('wrong');
        announce('지금은 살 수 없어요. 올리브잎을 더 모아 와요!', true);
        focusItem(item.id);
        return;
      }
      coins = remaining; // 0도 성공이다. 차감 결과는 엔진이 돌려준 값을 따른다.
      if (!owned.includes(item.id)) owned.push(item.id);
      opts.sfx?.('coin');
      putOn(item, true);
    } finally {
      buying = false;
    }
  }

  function close() {
    if (closed) return;
    closed = true;
    life.abort();
    screen.remove();
    if (!previewWasOpen) canvas?.classList.remove('wardrobe-preview');
    for (const saved of titles) {
      saved.el.style.visibility = saved.visibility;
      saved.el.inert = saved.inert;
      if (saved.hidden === null) saved.el.removeAttribute('aria-hidden');
      else saved.el.setAttribute('aria-hidden', saved.hidden);
    }
    opener?.isConnected && opener.focus({ preventScroll: true });
    resolve();
  }

  function chooseSlot(key: WardrobeSlot) {
    slot = key;
    opts.sfx?.('ui_click');
    render();
    announce(SLOTS[key].name + '을 골라 봐요.');
    tabs.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
  }

  screen.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (!target || !screen.contains(target)) return;
    if (pending) {
      if (target.dataset.action === 'cancel') cancelPurchase();
      else if (target.dataset.action === 'buy') purchase();
      return;
    }
    if (target.dataset.action === 'close') { opts.sfx?.('ui_click'); close(); }
    else if (target.dataset.slot) chooseSlot(target.dataset.slot as WardrobeSlot);
    else if (target.dataset.item) {
      const item = items.get(target.dataset.item);
      if (item) selectItem(item);
    }
  }, { signal: life.signal });

  screen.addEventListener('focusin', (event) => {
    const target = event.target;
    if (target instanceof HTMLButtonElement && target.dataset.item) {
      remembered.set(slot, target.dataset.item);
      for (const button of list.querySelectorAll<HTMLButtonElement>('button')) button.tabIndex = button === target ? 0 : -1;
    }
  }, { signal: life.signal });

  window.addEventListener('keydown', (event) => {
    if (!['Escape', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Space', 'Enter', 'NumpadEnter'].includes(event.code)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat && !event.code.startsWith('Arrow')) return;
    if (event.code === 'Escape') {
      opts.sfx?.('ui_click');
      if (pending) cancelPurchase();
      else close();
      return;
    }
    const scope = confirmation ?? card;
    const buttons = [...scope.querySelectorAll<HTMLButtonElement>('button')].filter((el) => !el.disabled && el.tabIndex >= 0);
    const active = document.activeElement;
    if (event.code === 'Tab') {
      const index = buttons.findIndex((el) => el === active);
      const next = index < 0 ? (event.shiftKey ? buttons.length - 1 : 0)
        : (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    } else if (['Space', 'Enter', 'NumpadEnter'].includes(event.code)) {
      if (active instanceof HTMLButtonElement && scope.contains(active)) active.click();
    } else if (pending) {
      const index = buttons.findIndex((el) => el === active);
      const step = event.code === 'ArrowLeft' || event.code === 'ArrowUp' || event.code === 'Home' ? -1 : 1;
      buttons[(Math.max(0, index) + step + buttons.length) % buttons.length]?.focus();
    } else if (active instanceof HTMLElement && tabs.contains(active)) {
      const step = event.code === 'ArrowLeft' || event.code === 'ArrowUp' ? -1 : 1;
      const index = event.code === 'Home' ? 0 : event.code === 'End' ? WARDROBE_SLOTS.length - 1
        : (WARDROBE_SLOTS.indexOf(slot) + step + WARDROBE_SLOTS.length) % WARDROBE_SLOTS.length;
      chooseSlot(WARDROBE_SLOTS[index]);
    } else if (active instanceof HTMLElement && list.contains(active)) {
      const choices = [...list.querySelectorAll<HTMLButtonElement>('button')];
      const index = Math.max(0, choices.findIndex((el) => el === active));
      const step = event.code === 'ArrowLeft' || event.code === 'ArrowUp' ? -1 : 1;
      const next = event.code === 'Home' ? 0 : event.code === 'End' ? choices.length - 1
        : (index + step + choices.length) % choices.length;
      const id = choices[next]?.dataset.item;
      if (id) focusItem(id);
    }
  }, { capture: true, signal: life.signal });

  render();
  root.append(screen);
  tabs.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
});
