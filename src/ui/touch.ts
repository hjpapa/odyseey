/** 터치 조작 — 왼쪽 가상 조이스틱 + 오른쪽 버튼 (탐험) / 좌우 버튼 + 점프 (러너) */
import type { Button, Input } from '../core/input';
import { h } from './dom';

export type TouchLayout = 'explore' | 'runner' | 'none';

export class TouchControls {
  private el = h('div', { class: 'touch' });
  private layout: TouchLayout = 'none';
  private actBtn: HTMLButtonElement | null = null;

  constructor(root: HTMLElement, private input: Input) {
    root.append(this.el);
    input.onTouchModeChange = () => this.render();
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

  private render() {
    this.el.replaceChildren();
    this.actBtn = null;
    this.input.setTouchMove(0, 0);
    if (!this.input.touchMode || this.layout === 'none') return;
    if (this.layout === 'explore') this.renderExplore();
    else this.renderRunner();
  }

  private button(label: string, b: Button, cls = '') {
    const el = h('button', { class: `tbtn ${cls}`, type: 'button', 'aria-label': label, text: label });
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('pressed');
      this.input.press(b);
    });
    const up = () => el.classList.remove('pressed');
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
      this.button('⚔️', 'attack', 'big'),
    );
    this.actBtn = this.button('✋', 'interact', 'act');
    this.actBtn.style.display = 'none';
    grid.append(this.actBtn);
    this.el.append(zone, grid);
  }

  private renderRunner() {
    const lanes = h('div', { class: 'touch-lanes' });
    lanes.append(
      h('div', { class: 'group' }, this.button('◀', 'left'), this.button('▶', 'right')),
      h('div', { class: 'group' }, this.button('⤴️', 'jump', 'big')),
    );
    this.el.append(lanes);
  }
}
