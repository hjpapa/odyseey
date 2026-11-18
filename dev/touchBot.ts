/**
 * 개발용 자동 플레이어 — 터치 입력만으로 새 게임부터 엔딩까지 놀아 본다.
 * 순간이동·체력 회복·장 건너뛰기 없이, 화면의 조이스틱·버튼을 실제 좌표로 누른다 (가려진 버튼은 문제로 기록).
 *
 * 쓰는 법 (npm run dev, 브라우저 콘솔):
 *   localStorage.removeItem('odyseey.save.v1'); location.href = '/';
 *   const bot = await import('/dev/touchBot.ts'); bot.start({ grade: 2 });
 *   window.BOT  // 진행 기록
 *
 * 게임의 내부 상태는 '어디로 가야 하는지'를 알아내려고 읽기만 하고, 값을 바꾸지는 않는다.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

export interface BotOptions {
  grade?: 1 | 2 | 3;
  /** 첫 시도에 일부러 틀리는 비율 (오답 힌트·복습 경로 시험) */
  wrongRate?: number;
  /** 보물상자·부엉이 신전도 들르기 */
  collectAll?: boolean;
  /** 이 장까지만 하고 멈춤 */
  until?: string;
  /** 새 게임 대신 '이어하기'로 시작 */
  resume?: boolean;
  /** clumsy: 피하지 않고 타이밍도 엉망인 서툰 플레이 — 그래도 끝까지 갈 수 있는지 본다 */
  skill?: 'good' | 'clumsy';
}

interface ChapterLog {
  id: string;
  gameSec: number;
  realSec: number;
  deaths: number;
  hurt: number;
  quizzes: number;
  wrong: number;
  coins: number;
  chests: number;
  shrines: number;
  minis: string[];
  boss?: string;
  bossSec?: number;
  notes: string[];
  /** 맞은 순간 기록: 시각·남은 하트·가까운 적 수·보스 유무·예고 원 안 */
  hits: string[];
}

const w = window as Any;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll<T>(s)];
const shown = (el: Element | null | undefined): el is HTMLElement => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
};
const byText = (s: string, text: string | RegExp, root: ParentNode = document) =>
  $$<HTMLElement>(s, root).find((b) => shown(b) && (typeof text === 'string' ? b.textContent?.includes(text) : text.test(b.textContent ?? '')));

export const BOT: Any = { log: [] as ChapterLog[], issues: [] as string[], phase: 'idle', done: false, stop: false, error: null, now: '' };

// ─── 손가락 ──────────────────────────────────────────────

let pid = 10;
function fire(el: Element, type: string, x: number, y: number, id: number) {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true, pointerId: id, pointerType: 'touch', isPrimary: true,
    button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }));
}
const issue = (t: string) => {
  if (BOT.issues.length < 200 && !BOT.issues.includes(t)) BOT.issues.push(t);
};
const label = (el: Element) => (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 16);

/** 그 자리를 실제로 누른다 — 맨 위에 있는 것이 눌린다 */
function hitAt(el: HTMLElement) {
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const hit = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) issue(`[${label(el)}] 가려져서 못 누름 ← ${hit ? label(hit) : '없음'}`);
  if (Math.min(r.width, r.height) < 36) issue(`[${label(el)}] 너무 작음 ${r.width | 0}×${r.height | 0}`);
  return { x, y, hit: hit ?? el };
}

function tap(el: HTMLElement) {
  const { x, y, hit } = hitAt(el);
  const id = ++pid;
  fire(hit, 'pointerdown', x, y, id);
  fire(hit, 'pointerup', x, y, id);
  hit.click();
}

/** 터치 버튼 (누르는 순간 동작) */
function press(el: HTMLElement) {
  const { x, y, hit } = hitAt(el);
  const id = ++pid;
  fire(hit, 'pointerdown', x, y, id);
  fire(hit, 'pointerup', x, y, id);
}

function drag(el: Element, path: [number, number][]) {
  const id = ++pid;
  fire(el, 'pointerdown', path[0][0], path[0][1], id);
  for (const [x, y] of path.slice(1)) fire(el, 'pointermove', x, y, id);
  const [x, y] = path[path.length - 1];
  fire(el, 'pointerup', x, y, id);
}

// 조이스틱
const stick: { zone: HTMLElement | null; id: number; x: number; y: number } = { zone: null, id: 0, x: 0, y: 0 };
function stickUp() {
  if (stick.zone?.isConnected) fire(stick.zone, 'pointerup', stick.x, stick.y, stick.id);
  stick.zone = null;
}
/** 월드 방향 (dx, dz) 으로 — 카메라 기준 입력으로 바꿔 조이스틱을 민다 */
function stickTo(st: Any, dx: number, dz: number) {
  const zone = $('.joy-zone');
  if (!zone) return;
  if (stick.zone !== zone) {
    const r = zone.getBoundingClientRect();
    stick.zone = zone;
    stick.id = ++pid;
    stick.x = r.left + r.width * 0.5;
    stick.y = r.top + r.height * 0.6;
    fire(zone, 'pointerdown', stick.x, stick.y, stick.id);
  }
  const f = st.cam.forward();
  const g = st.cam.right();
  const len = Math.hypot(dx, dz) || 1;
  const my = (dx * f.x + dz * f.z) / len;
  const mx = (dx * g.x + dz * g.z) / len;
  fire(zone, 'pointermove', stick.x + mx * 50, stick.y - my * 50, stick.id);
}

// ─── 길찾기 ──────────────────────────────────────────────

class Nav {
  readonly res = 1;
  readonly n: number;
  readonly R: number;
  readonly free: Uint8Array;
  readonly stamp: number;

  constructor(st: Any) {
    const world = st.world;
    this.R = Math.ceil(world.terrain.radius) + 4;
    this.n = this.R * 2 + 1;
    this.free = new Uint8Array(this.n * this.n);
    for (let i = 0; i < this.n; i++) for (let j = 0; j < this.n; j++) {
      if (world.terrain.isLand(i - this.R, j - this.R)) this.free[i * this.n + j] = 1;
    }
    let active = 0;
    for (const c of world.colliders) {
      if (!c.active) continue;
      active++;
      if (c.tag === 'boss') continue;
      const rr = c.r + 0.75;
      const a = Math.floor(c.x - rr);
      const b = Math.ceil(c.x + rr);
      for (let x = a; x <= b; x++) for (let z = Math.floor(c.z - rr); z <= Math.ceil(c.z + rr); z++) {
        if ((x - c.x) ** 2 + (z - c.z) ** 2 < rr * rr && this.has(x, z)) this.free[this.at(x, z)] = 0;
      }
    }
    this.stamp = active;
  }

  has(x: number, z: number) {
    return Math.abs(x) <= this.R && Math.abs(z) <= this.R;
  }

  at(x: number, z: number) {
    return (x + this.R) * this.n + (z + this.R);
  }

  isFree(x: number, z: number) {
    return this.has(x, z) && this.free[this.at(x, z)] === 1;
  }

  /** (sx,sz) 에서 목표 둘레 stop 안의 칸까지 */
  find(sx: number, sz: number, gx: number, gz: number, stop: number): [number, number][] | null {
    let cx = Math.round(sx);
    let cz = Math.round(sz);
    if (!this.isFree(cx, cz)) {
      // 기둥 옆에 붙어 있으면 가장 가까운 빈칸에서 시작
      let best: [number, number] | null = null;
      let bd = 1e9;
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        if (this.isFree(cx + dx, cz + dz) && dx * dx + dz * dz < bd) { bd = dx * dx + dz * dz; best = [cx + dx, cz + dz]; }
      }
      if (!best) return null;
      [cx, cz] = best;
    }
    const size = this.n * this.n;
    const g = new Float32Array(size).fill(Infinity);
    const from = new Int32Array(size).fill(-1);
    const heapI: number[] = [];
    const heapF: number[] = [];
    const push = (i: number, f: number) => {
      let k = heapI.length;
      heapI.push(i); heapF.push(f);
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heapF[p] <= f) break;
        heapI[k] = heapI[p]; heapF[k] = heapF[p]; k = p;
      }
      heapI[k] = i; heapF[k] = f;
    };
    const pop = () => {
      const top = heapI[0];
      const li = heapI.pop()!; const lf = heapF.pop()!;
      const len = heapI.length;
      if (len) {
        let k = 0;
        for (;;) {
          let c = 2 * k + 1;
          if (c >= len) break;
          if (c + 1 < len && heapF[c + 1] < heapF[c]) c++;
          if (heapF[c] >= lf) break;
          heapI[k] = heapI[c]; heapF[k] = heapF[c]; k = c;
        }
        heapI[k] = li; heapF[k] = lf;
      }
      return top;
    };
    const h = (x: number, z: number) => Math.max(0, Math.hypot(x - gx, z - gz) - stop);
    const start = this.at(cx, cz);
    g[start] = 0;
    push(start, h(cx, cz));
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let guard = 0;
    while (heapI.length && guard++ < 200000) {
      const i = pop();
      const x = Math.floor(i / this.n) - this.R;
      const z = (i % this.n) - this.R;
      if (Math.hypot(x - gx, z - gz) <= stop) {
        const out: [number, number][] = [];
        for (let k = i; k >= 0; k = from[k]) out.push([Math.floor(k / this.n) - this.R, (k % this.n) - this.R]);
        return out.reverse();
      }
      for (const [dx, dz, c] of D) {
        const nx = x + dx;
        const nz = z + dz;
        if (!this.isFree(nx, nz)) continue;
        if (dx && dz && (!this.isFree(x + dx, z) || !this.isFree(x, z + dz))) continue;
        const j = this.at(nx, nz);
        const ng = g[i] + c;
        if (ng < g[j]) {
          g[j] = ng;
          from[j] = i;
          push(j, ng + h(nx, nz));
        }
      }
    }
    return null;
  }
}

// ─── 상태 ────────────────────────────────────────────────

let opts: Required<BotOptions>;
let cur: ChapterLog | null = null;
let chapterStart = 0;
let nav: Nav | null = null;
let path: [number, number][] | null = null;
let pathGoal = '';
let pathI = 0;
let replanAt = 0;
let lastObj = '';
let objSince = 0;
let lastPos = { x: 0, z: 0, t: 0 };
let wasRespawning = false;
let lastHp = 5;
let skipSide = new Set<string>();
let attackAt = 0;
let seaNext = 0;
let question: Any = null;
let questionTries = 0;
let quizWrongPlanned = false;
let rand = mulberry(20261118);
const pages: string[] = [];

function mulberry(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clumsy = () => opts.skill === 'clumsy';
const game = () => w.game as Any;
const stage = () => game().debug.stage as Any;
const step = (s: number) => game().debugStep(s);
const note = (t: string) => {
  cur?.notes.push(`${Math.round(stage()?.time ?? 0)}s ${t}`);
};

function install() {
  Element.prototype.setPointerCapture = function () {};
  Element.prototype.releasePointerCapture = function () {};
  window.dispatchEvent(new Event('touchstart'));
  window.addEventListener('error', (e) => issue(`오류: ${e.message}`));
  window.addEventListener('unhandledrejection', (e) => issue(`오류: ${String((e as PromiseRejectionEvent).reason?.message ?? (e as PromiseRejectionEvent).reason)}`));
  const quiz = game().svc.ui.quiz;
  const present = quiz.present.bind(quiz);
  quiz.present = (q: Any, ctx: Any) => {
    question = q;
    questionTries = 0;
    quizWrongPlanned = rand() < opts.wrongRate;
    if (cur) cur.quizzes++;
    return present(q, ctx);
  };
}

/** 창이 가려져 그림 프레임이 오지 않으면 미니게임용으로 타이머로 대신한다 */
async function ensureFrames() {
  let fired = false;
  requestAnimationFrame(() => { fired = true; });
  await sleep(300);
  if (!fired) {
    w.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
    w.cancelAnimationFrame = (id: number) => clearTimeout(id);
  }
}

// ─── 퀴즈 ────────────────────────────────────────────────

async function answerQuiz() {
  const card = $('.quiz-card');
  if (!card) return;
  const next = $('.quiz-next .btn');
  if (next) {
    tap(next);
    await sleep(60);
    return;
  }
  const q = question;
  if (!q) { await sleep(30); return; }
  questionTries++;
  const wrongNow = quizWrongPlanned && questionTries === 1;
  if (wrongNow && cur) cur.wrong++;
  switch (q.kind) {
    case 'choice': {
      const bs = $$('.quiz-answers .answer', card);
      const pick = wrongNow ? bs.findIndex((b, i) => i !== q.answerIndex && !b.classList.contains('wrong')) : q.answerIndex;
      tap(bs[pick < 0 ? q.answerIndex : pick]);
      break;
    }
    case 'number': {
      const keys = $$('.numpad .answer', card);
      const value = wrongNow ? q.answer + 1 : q.answer;
      for (const d of String(value)) tap(keys.find((k) => k.textContent === d)!);
      tap($('.numpad .ok', card)!);
      break;
    }
    case 'spell': {
      const used = new Set<HTMLElement>();
      for (const ch of q.answer as string) {
        const t = $$('.spell-tiles .answer', card).find((b) => b.textContent === ch && !used.has(b) && !b.classList.contains('used'));
        if (!t) { issue(`철자 타일 없음: ${q.answer} '${ch}'`); break; }
        used.add(t);
        tap(t);
        await sleep(15);
      }
      break;
    }
    case 'order': {
      const bs = $$('.order-list .answer', card);
      for (const i of q.answerOrder as number[]) {
        tap(bs[i]);
        await sleep(15);
      }
      break;
    }
    case 'clockSet': {
      const svg = $<SVGSVGElement>('.clock-face.interactive', card)!;
      svg.scrollIntoView({ block: 'nearest' });
      const r = svg.getBoundingClientRect();
      const at = (deg: number, k: number): [number, number] => {
        const a = (deg * Math.PI) / 180;
        return [r.left + r.width / 2 + Math.sin(a) * (r.width / 2) * k, r.top + r.height / 2 - Math.cos(a) * (r.width / 2) * k];
      };
      // 처음 12:00 — 긴 바늘을 먼저 끌고, 그다음 짧은 바늘
      const { h, m } = q.answer;
      const minuteDeg = m * 6;
      if (m !== 0) drag(svg, [at(0, 0.8), at(minuteDeg / 2, 0.8), at(minuteDeg, 0.8)]);
      const fromHour = 0 + m * 0.5;
      const hourDeg = (h % 12) * 30 + m * 0.5;
      if (h % 12 !== 0) drag(svg, [at(fromHour, 0.3), at((fromHour + hourDeg) / 2, 0.3), at(hourDeg, 0.3)]);
      tap($('.clock-wrap > .btn', card)!);
      break;
    }
  }
  await sleep(50);
}

// ─── 미니게임 (손가락으로) ────────────────────────────────

let holdEl: HTMLElement | null = null;
let holdId = 0;
function holdDown(el: HTMLElement) {
  const { x, y, hit } = hitAt(el);
  holdEl = hit;
  holdId = ++pid;
  fire(hit, 'pointerdown', x, y, holdId);
}
function holdUp() {
  if (!holdEl) return;
  const r = holdEl.getBoundingClientRect();
  fire(holdEl, 'pointerup', r.left + 4, r.top + 4, holdId);
  holdEl = null;
}

async function playMini(p: HTMLElement) {
  const dm = p.dataset.minigame;
  const txt = p.textContent ?? '';
  const mark = (id: string) => { if (cur && !cur.minis.includes(id)) cur.minis.push(id); };
  if (txt.includes('통나무 놓기') || txt.includes('돛을 올려요') || txt.includes('뗏목 완성')) {
    mark('raftBuild');
    const b = byText('.btn', '통나무', p);
    if (b) tap(b);
    await sleep(120);
  } else if (txt.includes('양들과 살금살금')) {
    mark('sheepEscape');
    const sig = p.children[1].textContent ?? '';
    const go = byText('button', /이동|출발/, p);
    if (!clumsy() && (sig.includes('🟡') || sig.includes('🔴') || sig.includes('무사히'))) holdUp();
    else if (go && !holdEl) holdDown(go);
    if (sig.includes('괜찮아요')) { holdUp(); if (go) holdDown(go); }
    await sleep(50);
  } else if (txt.includes('바람 따라 이타카로')) {
    mark('windSail');
    const WIND = ['왼쪽 60°', '왼쪽 30°', '똑바로', '오른쪽 30°', '오른쪽 60°'];
    const want = WIND.findIndex((n) => p.children[1].textContent?.includes(n));
    const have = WIND.findIndex((n) => p.children[2].textContent?.includes(n));
    const btn = clumsy() && rand() < 0.4 ? $('[aria-label="바람 받기"]', p) : want === have ? $('[aria-label="바람 받기"]', p) : $(want > have ? '[aria-label="오른쪽으로 돛 돌리기"]' : '[aria-label="왼쪽으로 돛 돌리기"]', p);
    if (btn && !(btn as HTMLButtonElement).disabled) tap(btn);
    await sleep(120);
  } else if (dm === 'rhythmShield') {
    mark(dm);
    const action = $('.btn.gold', p)!;
    if (/시작하기|다음으로/.test(action.textContent ?? '')) tap(action);
    else {
      const lanes = $$('[aria-label$="줄 선택"]', p);
      const li = lanes.findIndex((b) => b.textContent?.includes('♪'));
      if (li >= 0 && lanes[li].getAttribute('aria-pressed') !== 'true') tap(lanes[li]);
      const icon = $$('span', p).find((s) => s.textContent === '♪');
      if (icon && icon.style.visibility !== 'hidden' && (clumsy() ? rand() < 0.04 : parseFloat(icon.style.top) >= 70)) tap(action);
    }
    await sleep(30);
  } else if (dm === 'ballGame') {
    mark(dm);
    const action = $('.btn.gold', p)!;
    if (/공놀이 시작|다음으로/.test(action.textContent ?? '')) tap(action);
    else {
      const icon = $$('span', p).find((s) => s.textContent === '⚽');
      const left = parseFloat(icon?.style.left ?? '0');
      if (clumsy() ? rand() < 0.04 : left >= 76 && left < 87.5) tap(action);
    }
    await sleep(30);
  } else if (dm === 'hideWeapons') {
    mark(dm);
    const action = $('.btn.gold', p)!;
    if (action.textContent?.includes('놓기')) tap(action);
    else {
      const item = $$<HTMLButtonElement>('.btn.gray.small[aria-pressed]', p).find((b) => !b.disabled);
      if (item) tap(item);
    }
    await sleep(100);
  } else if (dm === 'bowString' || dm === 'axeArchery') {
    mark(dm);
    const btn = $<HTMLButtonElement>('button.btn', p)!;
    const cursor = $('[role=progressbar] > div:nth-child(2)', p);
    const left = parseFloat(cursor?.style.left ?? '0');
    if (!btn.disabled && (clumsy() ? rand() < 0.03 : Math.abs(left - 50) < 8)) tap(btn);
    await sleep(25);
  } else if (dm === 'feast') {
    mark(dm);
    const b = byText('.btn', '잔치 시작', p);
    if (b) tap(b);
    await sleep(100);
  } else await sleep(60);
}

// ─── 화면 처리 (게임 조작이 아닌 것) ──────────────────────

async function handleScreens(): Promise<boolean> {
  const quizOpen = !!$('.quiz-backdrop');
  const mini = $('.mini-panel');
  if (quizOpen || $('.dialogue-layer') || $('.caption') || $('.screen') || mini || $('.hub-ui') || $('.wardrobe-screen')) stickUp();
  if (quizOpen) {
    await answerQuiz();
    return true;
  }
  const title = $('.titlecard .btn');
  if (title) { tap(title); await sleep(80); return true; }
  const dlg = $('.dialogue-layer');
  if (dlg) { tap(dlg); await sleep(45); return true; }
  const cap = $('.caption');
  if (cap) { tap(cap); await sleep(120); return true; }
  if ($('.book')) {
    const t = $('.book-text')?.textContent ?? '';
    if (t && pages[pages.length - 1] !== t) pages.push(t);
    tap(byText('.book .btn', /다음|끝/)!);
    await sleep(40);
    return true;
  }
  if ($('.credits')) { tap($('.credits-skip')!); await sleep(80); return true; }
  const report = $('.card.report');
  if (report) {
    BOT.report = report.innerText;
    BOT.pages = pages.slice();
    tap(byText('.btn', '지도', report)!);
    await sleep(300);
    return true;
  }
  if ($('.hub-ui')) {
    BOT.mapCount = $('.hub-count')?.textContent;
    tap(byText('.hub-top .btn', '처음 화면')!);
    await sleep(300);
    BOT.done = true;
    return true;
  }
  const card = $('.screen.dim .card');
  if (card) {
    const go = byText('.btn', /다음 장으로|엔딩 보기/, card);
    if (go) {
      finishChapter();
      if (opts.until && BOT.log[BOT.log.length - 1]?.id === opts.until) { BOT.done = true; return true; }
      tap(go);
      await sleep(200);
      return true;
    }
    const grade = byText('.grade-buttons .btn', `${opts.grade}학년`, card);
    if (grade) { tap(grade); await sleep(150); return true; }
    const resume = byText('.btn', '계속하기', card);
    if (resume) { note('멈춤 창이 열려 닫음'); tap(resume); await sleep(100); return true; }
    const yes = byText('.btn', '처음부터', card);
    if (yes) { tap(yes); await sleep(100); return true; }
    await sleep(60);
    return true;
  }
  if (mini) {
    await playMini(mini);
    await step(1 / 30);
    return true;
  }
  holdUp();
  const titleScreen = $('.title-screen');
  if (titleScreen) {
    const start = opts.resume
      ? byText('.title-screen .btn', '이어하기')
      : byText('.title-screen .btn', '모험 시작') ?? byText('.title-screen .btn', '처음부터');
    if (start) tap(start);
    await sleep(150);
    return true;
  }
  if ($('.fade.on')) { await sleep(40); return true; }
  return false;
}

// ─── 장 기록 ─────────────────────────────────────────────

function beginChapter(st: Any) {
  cur = { id: st.chapter.id, gameSec: 0, realSec: 0, deaths: 0, hurt: 0, quizzes: 0, wrong: 0, coins: 0, chests: 0, shrines: 0, minis: [], notes: [], hits: [] };
  chapterStart = performance.now();
  nav = null; path = null; pathGoal = ''; lastObj = ''; skipSide = new Set(); wasRespawning = false; lastHp = 99;
  attackAt = 0; seaNext = 0; replanAt = 0; lastPos = { x: 0, z: 0, t: 0 };
  BOT.now = st.chapter.id;
}

function finishChapter() {
  if (!cur) return;
  const st = stage();
  const save = game().svc.save.data;
  cur.gameSec = Math.round(st?.time ?? 0);
  cur.realSec = Math.round((performance.now() - chapterStart) / 1000);
  cur.coins = save?.coins ?? 0;
  cur.chests = save?.opened.length ?? 0;
  cur.shrines = save?.shrines.length ?? 0;
  BOT.log.push(cur);
  cur = null;
}

// ─── 섬에서 움직이기 ─────────────────────────────────────

function pathTo(st: Any, gx: number, gz: number, stop: number): boolean {
  const p = st.player.pos;
  const active = st.world.colliders.filter((c: Any) => c.active).length;
  if (!nav || nav.stamp !== active) {
    // 문이 열리면 전에 못 갔던 보물도 다시 시도한다
    if (nav) skipSide.clear();
    nav = new Nav(st);
    path = null;
  }
  const key = `${Math.round(gx)},${Math.round(gz)},${stop}`;
  if (!path || key !== pathGoal || st.time > replanAt) {
    path = nav.find(p.x, p.z, gx, gz, stop);
    pathGoal = key;
    pathI = 0;
    replanAt = st.time + 4;
  }
  return !!path;
}

/** 목표 쪽으로 조이스틱을 민다. 도착했으면 true */
function walk(st: Any, gx: number, gz: number, stop: number): 'there' | 'moving' | 'nopath' {
  const p = st.player.pos;
  if (Math.hypot(p.x - gx, p.z - gz) <= stop + 0.25) { stickUp(); return 'there'; }
  if (!pathTo(st, gx, gz, stop)) { stickUp(); return 'nopath'; }
  const pts = path!;
  while (pathI < pts.length - 1 && Math.hypot(pts[pathI][0] - p.x, pts[pathI][1] - p.z) < 1.3) pathI++;
  const [wx, wz] = pts[Math.min(pathI + 1, pts.length - 1)];
  stickTo(st, wx - p.x, wz - p.z);
  // 제자리에 끼었으면 길을 다시 찾는다
  if (st.time - lastPos.t > 1.2) {
    if (Math.hypot(p.x - lastPos.x, p.z - lastPos.z) < 0.4) { path = null; const jump = byText('.tbtn', '⤴️'); if (jump) press(jump); }
    lastPos = { x: p.x, z: p.z, t: st.time };
  }
  return 'moving';
}

const actBtn = () => { const b = $('.tbtn.act'); return shown(b) ? b : null; };
const attackBtn = () => $('.tbtn.big');

function attack(st: Any) {
  if (st.time < attackAt) return;
  attackAt = st.time + (clumsy() ? 0.75 : 0.22);
  const b = attackBtn();
  if (b) press(b);
}

/** 예고 원 안이면 피한다. 피하는 중이면 true */
function dodge(st: Any): boolean {
  if (clumsy()) return false;
  const p = st.player.pos;
  let worst: Any = null;
  let left = 1e9;
  for (const h of st.hazards.list) {
    const d = Math.hypot(p.x - h.x, p.z - h.z);
    const rem = h.delay - h.t;
    if (d <= h.r + 0.7 && rem < left) { left = rem; worst = h; }
  }
  if (!worst) return false;
  if (left < 0.3) { const roll = byText('.tbtn', '🌀'); if (roll) press(roll); }
  let dx = p.x - worst.x;
  let dz = p.z - worst.z;
  if (Math.hypot(dx, dz) < 0.2) { dx = 1; dz = 0.3; }
  // 물 쪽이면 옆으로
  const k = worst.r + 1.5;
  const tx = worst.x + (dx / Math.hypot(dx, dz)) * k;
  const tz = worst.z + (dz / Math.hypot(dx, dz)) * k;
  if (!st.world.terrain.isLand(tx, tz)) { stickTo(st, -dz, dx); return true; }
  stickTo(st, dx, dz);
  return true;
}

function nearestEnemy(st: Any, group?: string) {
  const p = st.player.pos;
  let best: Any = null;
  let bd = 1e9;
  for (const e of st.enemies) {
    if (!e.alive || (group && e.group !== group)) continue;
    const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best ? { e: best, d: bd } : null;
}

/** 지나는 길의 보물상자·신전 하나 고르기 */
function sideGoal(st: Any): { x: number; z: number; key: string } | null {
  if (!opts.collectAll) return null;
  const save = game().svc.save.data;
  const L = st.layout;
  const p = st.player.pos;
  let best: Any = null;
  let bd = 1e9;
  const check = (id: string, list: string[], pos: number[], kind: string) => {
    const key = `${L.id}:${id}`;
    if (list.includes(key) || skipSide.has(kind + key)) return;
    const d = Math.hypot(pos[0] - p.x, pos[1] - p.z);
    if (d < bd) { bd = d; best = { x: pos[0], z: pos[1], key: kind + key }; }
  };
  for (const c of L.chests) check(c.id, save.opened, c.pos, 'c:');
  for (const s of L.shrines) check(s.id, save.shrines, s.pos, 's:');
  return best;
}

function closedGate(st: Any): { x: number; z: number; id: string } | null {
  for (const g of st.layout.gates) {
    if (g.chapter !== st.chapter.id) continue;
    if (st.gateObjs.get(g.id)?.open === false) return { x: g.pos[0], z: g.pos[1], id: g.id };
  }
  return null;
}

async function islandTick(st: Any) {
  const pl = st.player;
  if (pl.hp < lastHp && lastHp !== 99 && cur) {
    cur.hurt += lastHp - pl.hp;
    const around = st.enemies.filter((e: Any) => e.alive && e.pos.distanceTo(pl.pos) < 3).length;
    const inCircle = st.hazards.list.some((h: Any) => Math.hypot(h.x - pl.pos.x, h.z - pl.pos.z) <= h.r + 0.4);
    if (cur.hits.length < 60) cur.hits.push(`${Math.round(st.time)}s 하트${pl.hp} 적${around}${st.boss?.alive ? ' 보스' : ''}${inCircle ? ' 원' : ''}`);
  }
  lastHp = pl.hp;
  if (st.respawning && !wasRespawning && cur) cur.deaths++;
  wasRespawning = st.respawning;
  const o = st.runner.objective;
  if (!o || st.isBlocked || st.respawning) {
    stickUp();
    await step(0.1);
    return;
  }
  const objKey = `${st.runner.index}:${o.type}:${o.target}`;
  if (objKey !== lastObj) {
    lastObj = objKey;
    objSince = st.time;
    path = null;
  }
  const waited = st.time - objSince;
  if (waited > (o.type === 'boss' ? 900 : 600)) {
    BOT.error = `${st.chapter.id} 목표에서 막힘: ${objKey} (${Math.round(waited)}초)`;
    BOT.stop = true;
    return;
  }

  const L = st.layout;
  const nearEnemy = nearestEnemy(st);
  if (dodge(st)) {
    if (nearEnemy && nearEnemy.d < 2.6) attack(st);
    await step(1 / 15);
    return;
  }

  const useAct = () => {
    const a = actBtn();
    if (a) press(a);
    return !!a;
  };

  // 곁길: 전투·버티기 중이 아니면 가까운 보물·신전부터
  if (!['boss', 'survive', 'defeat'].includes(o.type) && !nearEnemy) {
    const side = sideGoal(st);
    if (side) {
      const r = walk(st, side.x, side.z, 2.1);
      if (r === 'nopath') { skipSide.add(side.key); path = null; }
      else if (r === 'there') { if (!useAct()) skipSide.add(side.key); await step(0.15); return; }
      else { await step(1 / 15); return; }
    }
  }

  // 적이 바로 옆이면 맞서 싸운다
  if (nearEnemy && nearEnemy.d < 2.8) attack(st);

  let result: string = 'moving';
  switch (o.type) {
    case 'talk': {
      const n = L.npcs.find((x: Any) => x.id === o.target);
      result = walk(st, n.pos[0], n.pos[1], 2.7);
      if (result === 'there') useAct();
      break;
    }
    case 'reach': {
      const z = L.zones.find((x: Any) => x.id === o.target);
      result = walk(st, z.center[0], z.center[1], Math.max(0.8, z.radius * 0.6));
      break;
    }
    case 'collect':
    case 'rescue': {
      const list = st.pickups.filter((x: Any) => !x.taken && x.item === o.target);
      list.sort((a: Any, b: Any) => a.pos.distanceTo(pl.pos) - b.pos.distanceTo(pl.pos));
      const tgt = list[0];
      if (!tgt) { result = 'wait'; break; }
      result = walk(st, tgt.pos.x, tgt.pos.z, 1.15);
      break;
    }
    case 'defeat': {
      const e = nearestEnemy(st, o.target) ?? nearEnemy;
      if (!e) { result = 'wait'; break; }
      result = walk(st, e.e.pos.x, e.e.pos.z, 1.9);
      if (e.d < 2.8) attack(st);
      break;
    }
    case 'quiz': {
      const g = L.gates.find((x: Any) => x.quizSlot === o.target && x.chapter === st.chapter.id);
      if (!g) { result = 'wait'; break; }
      const open = st.gateObjs.get(g.id)?.open;
      result = walk(st, g.pos[0], g.pos[1], 3.0);
      if (result === 'there' && !open) useAct();
      break;
    }
    case 'boss': {
      const b = st.boss;
      if (!b || !b.alive) {
        const a = st.bossArena;
        result = a ? walk(st, a.x, a.z, a.radius) : 'wait';
      } else {
        if (cur && !cur.boss) { cur.boss = b.def.name; cur.bossSec = st.time; }
        if (b.def.melee) {
          result = walk(st, b.pos.x, b.pos.z, b.radius + 1.4);
          if (Math.hypot(b.pos.x - pl.pos.x, b.pos.z - pl.pos.z) < b.radius + 2.2) attack(st);
        } else {
          const a = st.bossArena;
          result = walk(st, a.x, a.z, 3);
        }
      }
      break;
    }
    case 'survive':
      stickUp();
      result = 'wait';
      break;
    case 'minigame': {
      const z = L.zones.find((x: Any) => x.id === o.target);
      if (!z) { result = 'wait'; break; }
      result = walk(st, z.center[0], z.center[1], Math.max(1.5, Math.min(2.4, z.radius)));
      if (result === 'there') useAct();
      break;
    }
    default:
      result = 'wait';
  }
  if (result === 'nopath') {
    // 닫힌 지혜의 문 너머일 수 있다
    const g = closedGate(st);
    if (g) {
      const r = walk(st, g.x, g.z, 3.0);
      if (r === 'there') useAct();
      else if (r === 'nopath') note(`길 없음: ${objKey}`);
    } else if (waited > 5 && Math.round(waited) % 30 === 0) note(`길 없음: ${objKey}`);
  }
  await step(result === 'there' ? 0.15 : 1 / 15);
}

// ─── 바다 ────────────────────────────────────────────────

async function seaTick(st: Any) {
  if (st.hp < lastHp && lastHp !== 99 && cur) cur.hurt += lastHp - st.hp;
  lastHp = st.hp;
  if (st.time > 1500) {
    BOT.error = `${st.chapter.id} 바다에서 25분 넘게 끝나지 않음 (z=${Math.round(st.z)}, 다시 시작 ${st.fails}번)`;
    BOT.stop = true;
    return;
  }
  if (cur) cur.notes = st.fails ? [`다시 시작 ${st.fails}번`] : cur.notes;
  if (!st.running || st.isBlocked || st.finishing) { await step(0.1); return; }
  if (clumsy()) {
    // 가끔만 반응한다
    if (st.time < seaNext) { await step(1 / 15); return; }
    seaNext = st.time + 0.5;
    if (rand() < 0.5) { await step(1 / 15); return; }
  }
  const lane = st.lane as number;
  const danger = (l: number) => {
    let score = 0;
    for (const t of st.things) {
      const dz = t.z - st.z;
      if (t.done || dz < -1.5) continue;
      if ((t.kind === 'rock' || t.kind === 'pool') && t.lane === l && dz < 16) score += 100 - dz;
      if (t.kind === 'bolt' && t.armed && t.lane === l) score += 200;
    }
    const b = st.boss;
    if (b?.active && b.phase === 'warn' && b.lane === l) score += 300;
    return score;
  };
  let want = lane;
  let best = danger(lane);
  // 필요한 글자가 있는 안전한 줄을 고른다
  const word = st.words?.[st.wordIdx % (st.words?.length || 1)]?.word as string | undefined;
  const need = word?.[st.letterIdx];
  for (const l of [0, 1, 2]) {
    let s = danger(l) + Math.abs(l - lane) * 0.5;
    if (need && st.things.some((t: Any) => t.kind === 'letter' && !t.done && t.lane === l && t.letter === need && t.z - st.z > 0 && t.z - st.z < 18)) s -= 30;
    if (s < best - 0.01) { best = s; want = l; }
  }
  const btns = $$('.touch-lanes .tbtn');
  if (want !== lane && st.time > attackAt) {
    attackAt = st.time + 0.12;
    const b = btns.find((x) => x.textContent === (want < lane ? '◀' : '▶'));
    if (b) press(b);
  }
  const wave = st.things.find((t: Any) => t.kind === 'wave' && !t.done && t.z - st.z > 0 && t.z - st.z < 4.4);
  if (wave && st.y <= 0.01) {
    const j = btns.find((x) => x.textContent === '⤴️');
    if (j) press(j);
  }
  await step(1 / 15);
}

// ─── 시작 ────────────────────────────────────────────────

export async function start(o: BotOptions = {}) {
  opts = { grade: o.grade ?? 2, wrongRate: o.wrongRate ?? 0.15, collectAll: o.collectAll ?? true, until: o.until ?? '', resume: o.resume ?? false, skill: o.skill ?? 'good' };
  rand = mulberry(20261118);
  Object.assign(BOT, { log: [], issues: [], phase: 'run', done: false, stop: false, error: null, now: 'title', startedAt: performance.now() });
  w.BOT = BOT;
  await ensureFrames();
  install();
  void loop().catch((e) => {
    BOT.error = `봇 오류: ${e?.message}\n${e?.stack ?? ''}`.slice(0, 800);
    BOT.stop = true;
  });
  return BOT;
}

async function loop() {
  let idle = 0;
  while (!BOT.done && !BOT.stop) {
    const st = stage();
    if (st?.chapter && (!cur || cur.id !== st.chapter.id) && st.runner?.index >= 0) beginChapter(st);
    if (await handleScreens()) { idle = 0; continue; }
    if (st?.chapter && 'lanes' in st) await seaTick(st);
    else if (st?.chapter && st.player) await islandTick(st);
    else {
      await step(0.1);
      if (++idle > 300) { BOT.error = `진행 없음 (${st?.constructor?.name})`; BOT.stop = true; }
    }
  }
  stickUp();
  BOT.phase = BOT.error ? 'stopped' : 'finished';
  BOT.totalReal = Math.round((performance.now() - BOT.startedAt) / 1000);
}

export function summary() {
  return {
    phase: BOT.phase, now: BOT.now, error: BOT.error, issues: BOT.issues,
    chapters: BOT.log.map((c: ChapterLog) => `${c.id} ${c.gameSec}s 죽음${c.deaths} 맞음${c.hurt} 문제${c.quizzes}(오답시도${c.wrong}) 🫒${c.coins} 상자${c.chests} 신전${c.shrines}${c.boss ? ` [${c.boss}]` : ''}${c.minis.length ? ` {${c.minis.join(',')}}` : ''}${c.notes.length ? ` ⚠${c.notes.join(' / ')}` : ''}`),
  };
}
