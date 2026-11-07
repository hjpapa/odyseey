/**
 * 입력 — 키보드·마우스·터치를 한 가지 상태로 모은다.
 * 매 프레임 frame() 으로 읽고, '눌림' 같은 한 번짜리 값은 읽은 뒤 지워진다.
 *
 * PC:  WASD/방향키 이동 · Space 점프 · J/왼쪽 클릭 공격 · Shift/K 구르기 · E/F 상호작용
 *      오른쪽 드래그 카메라 회전 · 휠 확대 · Esc/P 멈춤
 * 터치: 왼쪽 가상 조이스틱 · 오른쪽 버튼 · 빈 곳 드래그 카메라 회전
 */
export interface InputFrame {
  /** -1~1, x: 오른쪽 +, y: 앞 + */
  moveX: number;
  moveY: number;
  jump: boolean;
  attack: boolean;
  roll: boolean;
  interact: boolean;
  pause: boolean;
  left: boolean;
  right: boolean;
  camDX: number;
  camDY: number;
  zoom: number;
}

export type Button = 'jump' | 'attack' | 'roll' | 'interact' | 'pause' | 'left' | 'right';

export class Input {
  enabled = true;
  /** 터치 기기 여부 (처음 터치하면 true) */
  touchMode = false;
  onTouchModeChange: (on: boolean) => void = () => {};

  private keys = new Set<string>();
  private pressed = new Set<Button>();
  private touchMove = { x: 0, y: 0 };
  private cam = { dx: 0, dy: 0, zoom: 0 };
  private drag: { id: number; x: number; y: number } | null = null;

  constructor(canvas: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cam.zoom += Math.sign(e.deltaY);
    }, { passive: false });
    window.addEventListener('touchstart', () => this.setTouchMode(true), { passive: true });
    if (window.matchMedia?.('(pointer: coarse)').matches) this.touchMode = true;
  }

  setTouchMode(on: boolean) {
    if (this.touchMode === on) return;
    this.touchMode = on;
    this.onTouchModeChange(on);
  }

  /** 터치 조이스틱 값 (-1~1) */
  setTouchMove(x: number, y: number) {
    this.touchMove.x = x;
    this.touchMove.y = y;
  }

  press(b: Button) {
    if (this.enabled || b === 'pause') this.pressed.add(b);
  }

  /** 카메라 드래그 (터치 버튼 바깥) */
  addCamera(dx: number, dy: number) {
    this.cam.dx += dx;
    this.cam.dy += dy;
  }

  isHeld(code: string) {
    return this.keys.has(code);
  }

  frame(): InputFrame {
    const k = this.keys;
    let mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let my = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (mx === 0 && my === 0) {
      mx = this.touchMove.x;
      my = this.touchMove.y;
    } else {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
    }
    const f: InputFrame = {
      moveX: this.enabled ? mx : 0,
      moveY: this.enabled ? my : 0,
      jump: this.pressed.has('jump'),
      attack: this.pressed.has('attack'),
      roll: this.pressed.has('roll'),
      interact: this.pressed.has('interact'),
      pause: this.pressed.has('pause'),
      left: this.pressed.has('left'),
      right: this.pressed.has('right'),
      camDX: this.cam.dx,
      camDY: this.cam.dy,
      zoom: this.cam.zoom,
    };
    this.pressed.clear();
    this.cam.dx = 0;
    this.cam.dy = 0;
    this.cam.zoom = 0;
    return f;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat && !e.code.startsWith('Key') && !e.code.startsWith('Arrow')) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    this.setTouchMode(false);
    this.keys.add(e.code);
    if (e.repeat) return;
    switch (e.code) {
      case 'Space': this.press('jump'); e.preventDefault(); break;
      case 'KeyJ': this.press('attack'); break;
      case 'ShiftLeft': case 'ShiftRight': case 'KeyK': this.press('roll'); break;
      case 'KeyE': case 'KeyF': this.press('interact'); break;
      case 'Escape': case 'KeyP': this.press('pause'); break;
      case 'ArrowLeft': case 'KeyA': this.press('left'); break;
      case 'ArrowRight': case 'KeyD': this.press('right'); break;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      this.setTouchMode(true);
      if (!this.drag) this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      return;
    }
    this.setTouchMode(false);
    if (e.button === 0) this.press('attack');
    else if (e.button === 2 || e.button === 1) this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    this.cam.dx += e.clientX - this.drag.x;
    this.cam.dy += e.clientY - this.drag.y;
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.drag && e.pointerId === this.drag.id) this.drag = null;
  };
}
