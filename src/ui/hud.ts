/** 화면 위 정보: 하트·올리브잎 코인·목표·상호작용 안내·알림 */
import { h } from './dom';

export class Hud {
  readonly el: HTMLElement;
  private hearts = h('span', { class: 'pill hearts' });
  private coins = h('span', { class: 'pill coins' });
  private objective = h('div', { class: 'objective', 'aria-live': 'polite' });
  private prompt = h('div', { class: 'prompt' });
  private toasts = h('div', { class: 'toasts' });
  private extra = h('div', { class: 'hud-extra' });
  private hurt = h('div', { class: 'vignette-hurt' });
  private bossName = h('div', { class: 'name' });
  private bossFill = h('div', { class: 'fill' });
  private bossBar = h('div', { class: 'boss-bar', role: 'status' }, this.bossName, h('div', { class: 'track' }, this.bossFill));
  private pauseBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': '잠깐 멈추기', text: '⏸' });
  private promptText = '';
  onPause: () => void = () => {};
  onPromptClick: () => void = () => {};

  constructor(root: HTMLElement) {
    this.el = h(
      'div',
      { class: 'hud' },
      this.hurt,
      h('div', { class: 'hud-top' }, h('div', { class: 'hud-left' }, this.hearts, this.coins), this.objective, this.pauseBtn),
      this.extra,
      this.toasts,
    );
    this.pauseBtn.addEventListener('click', () => this.onPause());
    this.prompt.addEventListener('click', () => this.onPromptClick());
    this.el.style.display = 'none';
    root.append(this.el);
  }

  show(visible: boolean) {
    this.el.style.display = visible ? '' : 'none';
    if (!visible) this.setPrompt(null);
  }

  setHearts(cur: number, max: number) {
    const parts: string[] = [];
    for (let i = 0; i < max; i++) parts.push(i < cur ? '<span>❤️</span>' : '<span class="empty">❤️</span>');
    this.hearts.innerHTML = parts.join('');
    this.hearts.setAttribute('aria-label', `하트 ${cur}개`);
  }

  setCoins(n: number, bump = false) {
    this.coins.textContent = `🫒 ${n}`;
    if (bump) {
      this.coins.classList.remove('bump');
      void this.coins.offsetWidth;
      this.coins.classList.add('bump');
    }
  }

  setObjective(text: string | null, done = false) {
    this.objective.textContent = text ? `🎯 ${text}` : '';
    if (done) {
      this.objective.classList.remove('done');
      void this.objective.offsetWidth;
      this.objective.classList.add('done');
    }
  }

  setPrompt(text: string | null, key = 'E') {
    if (text === this.promptText) return;
    this.promptText = text ?? '';
    if (!text) {
      this.prompt.remove();
      return;
    }
    this.prompt.replaceChildren(text, h('kbd', { text: key }));
    if (!this.prompt.isConnected) this.el.append(this.prompt);
  }

  /** 보스 체력바 (null 이면 숨김) */
  setBoss(name: string | null, hp = 0, max = 1) {
    if (!name) {
      this.bossBar.remove();
      return;
    }
    this.bossName.textContent = `⚔️ ${name}`;
    this.bossFill.style.width = `${Math.max(0, Math.min(1, hp / max)) * 100}%`;
    this.bossBar.setAttribute('aria-label', `${name} 체력 ${hp}/${max}`);
    if (!this.bossBar.isConnected) this.el.append(this.bossBar);
  }

  setExtra(node: Node | null) {
    this.extra.replaceChildren(...(node ? [node] : []));
  }

  toast(text: string, ms = 2200) {
    const t = h('div', { class: 'toast', text });
    this.toasts.append(t);
    while (this.toasts.childElementCount > 3) this.toasts.firstElementChild?.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 320);
    }, ms);
  }

  flashHurt() {
    this.hurt.classList.add('on');
    setTimeout(() => this.hurt.classList.remove('on'), 260);
  }
}
