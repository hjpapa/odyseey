/**
 * SVG 아날로그 시계 — 보여 주기용과 바늘 끌어서 맞추기용.
 * 짧은 바늘(파랑) = 시, 긴 바늘(빨강) = 분.
 */
import type { ClockTime } from '../types/contracts';
import { clockHandAngles } from '../learning/generators/clock';

const NS = 'http://www.w3.org/2000/svg';
const C = 110;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export interface ClockFace {
  el: SVGSVGElement;
  get(): ClockTime;
  set(t: ClockTime): void;
}

export function createClockFace(initial: ClockTime, interactive?: { snapMinutes: number; onChange?: (t: ClockTime) => void }): ClockFace {
  const root = svg('svg', { viewBox: '0 0 220 220', class: `clock-face${interactive ? ' interactive' : ''}`, role: 'img', 'aria-label': '아날로그 시계' });
  root.append(svg('circle', { cx: C, cy: C, r: 104, fill: '#fffdf2', stroke: '#1d4f91', 'stroke-width': 8 }));
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const long = i % 5 === 0;
    const r1 = long ? 86 : 91;
    root.append(svg('line', {
      x1: C + Math.sin(a) * r1, y1: C - Math.cos(a) * r1,
      x2: C + Math.sin(a) * 97, y2: C - Math.cos(a) * 97,
      stroke: long ? '#1d2433' : '#9aa6b8', 'stroke-width': long ? 3 : 1.5, 'stroke-linecap': 'round',
    }));
  }
  for (let n = 1; n <= 12; n++) {
    const a = (n / 12) * Math.PI * 2;
    const t = svg('text', {
      x: C + Math.sin(a) * 70, y: C - Math.cos(a) * 70 + 8,
      'text-anchor': 'middle', 'font-size': 22, 'font-family': 'Jua, sans-serif', fill: '#1d2433',
    });
    t.textContent = String(n);
    root.append(t);
  }
  const hour = svg('line', { x1: C, y1: C + 10, x2: C, y2: C - 52, stroke: '#1d4f91', 'stroke-width': 10, 'stroke-linecap': 'round' });
  const minute = svg('line', { x1: C, y1: C + 14, x2: C, y2: C - 82, stroke: '#e74c3c', 'stroke-width': 6, 'stroke-linecap': 'round' });
  root.append(hour, minute, svg('circle', { cx: C, cy: C, r: 8, fill: '#1d2433' }));

  let time: ClockTime = { ...initial };
  const draw = () => {
    const { hourDeg, minuteDeg } = clockHandAngles(time);
    hour.setAttribute('transform', `rotate(${hourDeg} ${C} ${C})`);
    minute.setAttribute('transform', `rotate(${minuteDeg} ${C} ${C})`);
  };
  draw();

  if (interactive) {
    const snap = interactive.snapMinutes;
    let dragging: 'hour' | 'minute' | null = null;
    const angleOf = (e: PointerEvent) => {
      const r = root.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      return { deg: ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360, dist: Math.hypot(x, y) / (r.width / 2) };
    };
    const diff = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
    const apply = (deg: number) => {
      if (dragging === 'minute') {
        const m = (Math.round(deg / 6 / snap) * snap) % 60;
        if (m !== time.m) {
          time = { ...time, m };
          draw();
          interactive.onChange?.(time);
        }
      } else if (dragging === 'hour') {
        let hh = Math.round((deg - time.m * 0.5) / 30) % 12;
        if (hh <= 0) hh += 12;
        if (hh !== time.h) {
          time = { ...time, h: hh };
          draw();
          interactive.onChange?.(time);
        }
      }
    };
    root.addEventListener('pointerdown', (e) => {
      const { deg, dist } = angleOf(e);
      const { hourDeg, minuteDeg } = clockHandAngles(time);
      const dh = diff(deg, hourDeg);
      const dm = diff(deg, minuteDeg);
      // 가까운 바늘을 잡는다. 비슷하면 안쪽은 시침, 바깥은 분침
      dragging = Math.abs(dh - dm) < 20 ? (dist < 0.55 ? 'hour' : 'minute') : dh < dm ? 'hour' : 'minute';
      root.setPointerCapture(e.pointerId);
      apply(deg);
    });
    root.addEventListener('pointermove', (e) => {
      if (dragging) apply(angleOf(e).deg);
    });
    const stop = () => { dragging = null; };
    root.addEventListener('pointerup', stop);
    root.addEventListener('pointercancel', stop);
  }

  return {
    el: root,
    get: () => ({ ...time }),
    set(t) {
      time = { ...t };
      draw();
    },
  };
}
