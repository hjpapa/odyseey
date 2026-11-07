/** 아주 작은 DOM 도우미 */
type Child = Node | string | number | null | undefined | false;
type Attrs = {
  class?: string;
  text?: string;
  html?: string;
  style?: Partial<CSSStyleDeclaration>;
  [key: string]: unknown;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k === 'style') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 부모 신호가 중단되면 같이 중단되는 짧은 수명의 AbortController */
export function linked(parent: AbortSignal): AbortController {
  const ac = new AbortController();
  if (parent.aborted) ac.abort();
  else parent.addEventListener('abort', () => ac.abort(), { once: true, signal: ac.signal });
  return ac;
}

/**
 * 다음 '진행' 입력(탭·클릭·스페이스·엔터·E)을 기다린다.
 * signal 이 중단되면 리스너만 정리하고 영원히 기다린다 (장면을 나갈 때 뒤따르는 동작이 없도록).
 */
export function waitAdvance(target: HTMLElement, opts: { minMs?: number; autoMs?: number; signal?: AbortSignal } = {}): Promise<void> {
  return new Promise((resolve) => {
    if (opts.signal?.aborted) return;
    const start = performance.now();
    let auto: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      target.removeEventListener('pointerup', onPointer);
      window.removeEventListener('keydown', onKey, true);
      if (auto) clearTimeout(auto);
    };
    opts.signal?.addEventListener('abort', cleanup, { once: true });
    const done = () => {
      cleanup();
      if (!opts.signal?.aborted) resolve();
    };
    const ready = () => performance.now() - start >= (opts.minMs ?? 0);
    const onPointer = (e: PointerEvent) => {
      e.preventDefault();
      if (ready()) done();
    };
    const onKey = (e: KeyboardEvent) => {
      if (['Space', 'Enter', 'KeyE', 'KeyJ', 'NumpadEnter'].includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        if (ready()) done();
      }
    };
    target.addEventListener('pointerup', onPointer);
    window.addEventListener('keydown', onKey, true);
    if (opts.autoMs) auto = setTimeout(done, opts.autoMs);
  });
}
