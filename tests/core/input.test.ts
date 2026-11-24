import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../../src/core/input';

describe('UI와 게임 키보드 입력 분리', () => {
  let keyboard: EventTarget;
  let input: Input;

  beforeEach(() => {
    keyboard = new EventTarget();
    vi.stubGlobal('window', keyboard);
    input = new Input(new EventTarget() as unknown as HTMLElement);
  });

  afterEach(() => vi.unstubAllGlobals());

  const sendKey = (code: string, type = 'keydown', consumed = false) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { code, repeat: false });
    if (consumed) event.preventDefault();
    keyboard.dispatchEvent(event);
  };

  it.each(['KeyP', 'KeyE', 'KeyJ', 'KeyW', 'KeyA', 'KeyD', 'KeyK'])(
    'UI가 사용한 %s는 게임 동작이나 이동으로 남지 않는다',
    (code) => {
      sendKey(code, 'keydown', true);

      expect(input.frame()).toMatchObject({
        moveX: 0,
        moveY: 0,
        jump: false,
        attack: false,
        roll: false,
        interact: false,
        pause: false,
        left: false,
        right: false,
      });
      expect(input.isHeld(code)).toBe(false);
    },
  );

  it('게임 조작이 꺼진 동안 P를 눌러도 멈춤이 예약되지 않는다', () => {
    input.enabled = false;
    sendKey('KeyP');
    expect(input.frame().pause).toBe(false);

    input.enabled = true;
    expect(input.frame().pause).toBe(false);
  });

  it('게임 조작 중 P는 한 번 멈춘다', () => {
    sendKey('KeyP');
    expect(input.frame().pause).toBe(true);
    expect(input.frame().pause).toBe(false);
  });

  it('게임 조작이 꺼져 있어도 Escape로 멈출 수 있다', () => {
    input.enabled = false;
    sendKey('Escape');
    expect(input.frame().pause).toBe(true);
    expect(input.frame().pause).toBe(false);
  });

  it('메뉴 버튼의 Space는 브라우저 동작에 맡기고 플레이 화면에서는 점프한다', () => {
    const menuKey = new Event('keydown', { cancelable: true });
    Object.assign(menuKey, { code: 'Space', repeat: false });
    Object.defineProperty(menuKey, 'target', { value: { tagName: 'BUTTON', closest: () => ({}) } });
    keyboard.dispatchEvent(menuKey);
    expect(menuKey.defaultPrevented).toBe(false);
    expect(input.frame().jump).toBe(false);

    sendKey('Space');
    expect(input.frame().jump).toBe(true);
  });

  it('일반 이동은 유지되고 상호작용과 공격은 한 번씩 전달된다', () => {
    sendKey('KeyW');
    sendKey('KeyD');
    sendKey('KeyE');
    sendKey('KeyJ');

    const first = input.frame();
    expect(first.moveX).toBeCloseTo(Math.SQRT1_2);
    expect(first.moveY).toBeCloseTo(Math.SQRT1_2);
    expect(first).toMatchObject({ interact: true, attack: true, pause: false });

    const held = input.frame();
    expect(held.moveX).toBeCloseTo(Math.SQRT1_2);
    expect(held.moveY).toBeCloseTo(Math.SQRT1_2);
    expect(held).toMatchObject({ interact: false, attack: false, pause: false });

    sendKey('KeyW', 'keyup');
    sendKey('KeyD', 'keyup');
    expect(input.frame()).toMatchObject({ moveX: 0, moveY: 0 });
  });
});
