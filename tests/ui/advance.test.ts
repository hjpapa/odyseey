import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitAdvance } from '../../src/ui/dom';

// Node 24의 boolean capture 제거 동작을 브라우저와 같게 맞춘다.
class KeyboardTarget extends EventTarget {
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void {
    super.removeEventListener(type, listener, typeof options === 'boolean' ? { capture: options } : options);
  }
}

describe('대사·자막의 일시정지 중 진행 방지', () => {
  let keyboard: EventTarget;
  let target: HTMLElement;
  let controller: AbortController;
  let page: { hidden: boolean; settingsOpen: boolean };

  beforeEach(() => {
    vi.useFakeTimers();
    keyboard = new KeyboardTarget();
    target = new EventTarget() as unknown as HTMLElement;
    controller = new AbortController();
    page = { hidden: false, settingsOpen: false };
    vi.stubGlobal('window', keyboard);
    vi.stubGlobal('document', {
      get hidden() { return page.hidden; },
      querySelector: (selector: string) => selector === '.screen.dim' && page.settingsOpen ? {} : null,
    });
  });

  afterEach(() => {
    controller.abort();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const sendKey = (code = 'Space') => {
    const event = new Event('keydown', { cancelable: true });
    Object.assign(event, { code, repeat: false });
    keyboard.dispatchEvent(event);
    return event;
  };
  const sendPointer = () => {
    const event = new Event('pointerup', { cancelable: true });
    target.dispatchEvent(event);
    return event;
  };

  it('설정 창의 Space와 포인터 입력은 넘겨주고, 재개한 뒤의 Space로 진행한다', async () => {
    page.settingsOpen = true;
    const advanced = vi.fn();
    const pending = waitAdvance(target, { signal: controller.signal }).then(advanced);

    expect(sendKey().defaultPrevented).toBe(false);
    expect(sendPointer().defaultPrevented).toBe(false);
    await Promise.resolve();
    expect(advanced).not.toHaveBeenCalled();

    page.settingsOpen = false;
    expect(sendKey().defaultPrevented).toBe(true);
    await pending;
    expect(advanced).toHaveBeenCalledOnce();
  });

  it('숨겨진 탭의 입력으로 진행하지 않고, 돌아온 뒤 포인터 입력으로 진행한다', async () => {
    page.hidden = true;
    const advanced = vi.fn();
    const pending = waitAdvance(target, { signal: controller.signal }).then(advanced);

    expect(sendKey('Enter').defaultPrevented).toBe(false);
    expect(sendPointer().defaultPrevented).toBe(false);
    await Promise.resolve();
    expect(advanced).not.toHaveBeenCalled();

    page.hidden = false;
    expect(sendPointer().defaultPrevented).toBe(true);
    await pending;
    expect(advanced).toHaveBeenCalledOnce();
  });

  it.each(['settings', 'hidden'] as const)('%s 동안 자동 진행을 미루고 재개 후 한 번만 진행한다', async (pause) => {
    page.settingsOpen = pause === 'settings';
    page.hidden = pause === 'hidden';
    const advanced = vi.fn();
    const pending = waitAdvance(target, { autoMs: 500, signal: controller.signal }).then(advanced);

    await vi.advanceTimersByTimeAsync(1500);
    expect(advanced).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    page.settingsOpen = false;
    page.hidden = false;
    await vi.advanceTimersByTimeAsync(200);
    expect(advanced).toHaveBeenCalledOnce();
    await pending;
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(2000);
    expect(sendKey().defaultPrevented).toBe(false);
    expect(sendPointer().defaultPrevented).toBe(false);
    expect(advanced).toHaveBeenCalledOnce();
  });

  it('중단하면 미뤄둔 타이머와 입력 리스너를 정리하고 뒤따르는 진행을 막는다', async () => {
    page.settingsOpen = true;
    const advanced = vi.fn();
    const removeKey = vi.spyOn(keyboard, 'removeEventListener');
    const removePointer = vi.spyOn(target, 'removeEventListener');
    void waitAdvance(target, { autoMs: 500, signal: controller.signal }).then(advanced);

    await vi.advanceTimersByTimeAsync(600);
    expect(vi.getTimerCount()).toBe(1);
    controller.abort();

    expect(vi.getTimerCount()).toBe(0);
    expect(removeKey).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    expect(removePointer).toHaveBeenCalledWith('pointerup', expect.any(Function));
    page.settingsOpen = false;
    expect(sendKey().defaultPrevented).toBe(false);
    expect(sendPointer().defaultPrevented).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(advanced).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
