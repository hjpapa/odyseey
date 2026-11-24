import { SUPPLY_IDS, SUPPLY_INFO, type Supplies, type SupplyId } from '../game/supplies';
import { h, linked } from './dom';
import './satchel.css';

export function openSatchel(
  root: HTMLElement,
  supplies: Supplies,
  signal: AbortSignal,
  use: (id: SupplyId) => string,
): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const life = linked(signal);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const status = h('p', { class: 'satchel-status', role: 'status', text: '보물상자에서 찾은 물건을 쓸 수 있어요.' });
    const close = h('button', { class: 'btn small', type: 'button', text: '가방 닫기' });
    const rows = SUPPLY_IDS.map((id) => {
      const item = SUPPLY_INFO[id];
      const count = h('span', { class: 'satchel-count' });
      const action = h('button', { class: 'btn small gold', type: 'button', text: '사용', 'aria-label': item.name + ' 쓰기' });
      const row = h('div', { class: 'satchel-item' },
        h('span', { class: 'satchel-icon', 'aria-hidden': true, text: item.icon }),
        h('div', {}, h('strong', { text: item.name }, count), h('p', { text: item.help })),
        action,
      );
      return { id, row, count, action };
    });
    const card = h('section', { class: 'card satchel-card' },
      h('h2', { text: '🎒 모험 가방' }), ...rows.map(({ row }) => row), status, close,
    );
    const screen = h('div', { class: 'screen dim satchel-screen', role: 'dialog', 'aria-modal': 'true', 'aria-label': '모험 가방' }, card);
    function refresh() {
      for (const { id, count, action } of rows) {
        count.textContent = ' ' + supplies[id] + '개';
        action.setAttribute('aria-disabled', String(supplies[id] === 0));
      }
    }
    life.signal.addEventListener('abort', () => {
      screen.remove();
      // HUD 의 가방 버튼으로는 포커스를 돌려주지 않는다 — 돌려주면 다음 Space(점프)가 가방을 다시 연다
      if (!signal.aborted && opener?.isConnected && !opener.closest('.hud')) opener.focus();
      else opener?.blur();
      resolve();
    }, { once: true });
    close.addEventListener('click', () => life.abort(), { signal: life.signal });
    for (const { id, action } of rows) {
      action.addEventListener('click', () => {
        status.textContent = use(id);
        refresh();
      }, { signal: life.signal });
    }
    const buttons = [...rows.map(({ action }) => action), close];
    window.addEventListener('keydown', (event) => {
      if (!['Escape', 'Tab', 'Space', 'Enter', 'NumpadEnter'].includes(event.code)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      const current = buttons.findIndex((button) => button === document.activeElement);
      if (event.code === 'Escape') life.abort();
      else if (event.code === 'Tab') {
        const next = current < 0 ? (event.shiftKey ? buttons.length - 1 : 0)
          : (current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      } else buttons[current]?.click();
    }, { capture: true, signal: life.signal });
    refresh();
    root.append(screen);
    close.focus();
  });
}
