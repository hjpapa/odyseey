/**
 * 터치 조작
 * - 탐험: 왼쪽 가상 조이스틱 + 오른쪽 버튼
 * - 바다(러너·항해): ◀ 는 왼쪽 끝, ▶ 는 오른쪽 끝 — 가고 싶은 쪽 손으로 누른다. 화면을 밀어도 줄이 바뀐다.
 *   러너는 양손 모두 ⤴️ 가 닿게 두 개 (넘을 때가 되면 반짝인다)
 */
import type { Button, Input } from '../core/input';
import { h } from './dom';

export type TouchLayout = 'explore' | 'runner' | 'sail' | 'none';

/** 이만큼(px) 밀면 한 줄 옮긴다 */
const SWIPE = 36;

export class TouchControls {
  private el = h('div', { class: 'touch' });
  private layout: TouchLayout = 'none';
  private actBtn: HTMLButtonElement | null = null;
  private jumpBtns: HTMLButtonElement[] = [];
  private repeat: ReturnType<typeof setInterval> | null = null;

  constructor(root: HTMLElement, private input: Input) {
    root.append(this.el);
    input.onTouchModeChange = () => this.render();
    this.markMode();
  }

  /** 터치로 노는 중인지 CSS 에 알린다 (안내 문구 자리가 달라진다) */
  private markMode() {
    document.documentElement.classList.toggle('touch-mode', this.input.touchMode);
  }

  set(layout: TouchLayout) {
    if (this.layout === layout) return;
    this.layout = layout;
    this.render();
  }

  /** 상호작용할 것이 가까이 있을 때 ✋ 버튼 표시 */
  setInteract(label: string | null) {
    if (!this.actBtn) return;
    this.actBtn.style.display = label ? '' : 'none';
    if (label) this.actBtn.setAttribute('aria-label', label);
  }

  /** 파도를 넘을 때가 되면 ⤴️ 버튼이 반짝인다 */
  setJumpReady(on: boolean) {
    for (const b of this.jumpBtns) b.classList.toggle('ready', on);
  }

  private stopRepeat() {
    if (this.repeat !== null) clearInterval(this.repeat);
    this.repeat = null;
  }

  private render() {
    this.markMode();
    this.stopRepeat();
    this.el.replaceChildren();
    this.actBtn = null;
    this.jumpBtns = [];
    this.input.setTouchMove(0, 0);
    if (!this.input.touchMode || this.layout === 'none') return;
    if (this.layout === 'explore') this.renderExplore();
    else this.renderLanes(this.layout === 'runner');
  }

  /** holdMs: 누르고 있으면 그 간격으로 계속 (칼 휘두르기) */
  private button(label: string, b: Button, cls = '', holdMs = 0) {
    const el = h('button', { class: `tbtn ${cls}`, type: 'button', 'aria-label': label, text: label });
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('pressed');
      this.input.press(b);
      if (holdMs) {
        this.stopRepeat();
        this.repeat = setInterval(() => this.input.press(b), holdMs);
      }
    });
    const up = () => {
      el.classList.remove('pressed');
      if (holdMs) this.stopRepeat();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    return el;
  }

  private renderExplore() {
    const zone = h('div', { class: 'joy-zone' });
    const base = h('div', { class: 'joy-base' });
    const knob = h('div', { class: 'joy-knob' });
    base.append(knob);
    base.style.display = 'none';
    zone.append(base);
    let id: number | null = null;
    let cx = 0;
    let cy = 0;
    const R = 52;
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      e.preventDefault();
      id = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      const r = zone.getBoundingClientRect();
      cx = e.clientX;
      cy = e.clientY;
      base.style.left = `${cx - r.left}px`;
      base.style.top = `${cy - r.top}px`;
      base.style.display = '';
      knob.style.transform = 'translate(0, 0)';
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const mag = Math.min(1, len / R);
      const dead = mag < 0.15 ? 0 : 1;
      this.input.setTouchMove((dx / R) * dead, (-dy / R) * dead);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      base.style.display = 'none';
      this.input.setTouchMove(0, 0);
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    const grid = h('div', { class: 'touch-buttons' });
    grid.append(
      h('span'),
      this.button('⤴️', 'jump'),
      this.button('🌀', 'roll'),
      this.button('⚔️', 'attack', 'big', 240),
    );
    this.actBtn = this.button('✋', 'interact', 'act');
    this.actBtn.style.display = 'none';
    grid.append(this.actBtn);
    this.el.append(zone, grid);
  }

  /** 바다: 양 끝에 ◀ ▶, 그 안쪽에 ⤴️ (러너만), 버튼 밖 화면은 밀어서 조종 */
  private renderLanes(jump: boolean) {
    const swipe = h('div', { class: 'swipe-zone' });
    // 손가락을 끄는 동안 SWIPE 만큼 갈 때마다 한 줄씩 — 길게 끌면 두 줄도 간다. 위로 밀면 점프
    let drag: { id: number; x: number; y: number } | null = null;
    swipe.addEventListener('pointerdown', (e) => {
      if (drag) return;
      e.preventDefault();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      swipe.setPointerCapture?.(e.pointerId);
    });
    swipe.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
      if (Math.abs(dx) >= Math.abs(dy)) this.input.press(dx < 0 ? 'left' : 'right');
      else if (dy < 0 && jump) this.input.press('jump');
      drag.x = e.clientX;
      drag.y = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) drag = null;
    };
    swipe.addEventListener('pointerup', end);
    swipe.addEventListener('pointercancel', end);

    const side = (label: string, b: Button) => {
      const dir = this.button(label, b, 'dir');
      if (!jump) return h('div', { class: 'group' }, dir);
      const up = this.button('⤴️', 'jump', 'big');
      this.jumpBtns.push(up);
      return b === 'left' ? h('div', { class: 'group' }, dir, up) : h('div', { class: 'group' }, up, dir);
    };
    const lanes = h('div', { class: 'touch-lanes' }, side('◀', 'left'), side('▶', 'right'));
    this.el.append(swipe, lanes);
  }
}
