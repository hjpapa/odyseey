/**
 * 퀴즈 창 — 보기 고르기 / 숫자 패드 / 시계 바늘 맞추기 / 철자 타일 / 순서 맞추기.
 * 틀리면: 힌트 → 다시 도전 → 두 번째도 틀리면 정답과 설명을 보여 주고 넘어간다 (벌 없음).
 */
import type { ClockSetQuestion, ChoiceQuestion, NumberQuestion, OrderQuestion, Question, QuizPlacement, SpellQuestion, Subject } from '../types/contracts';
import type { PresentContext, QuizPresenter } from '../learning/engine';
import { answerText } from '../learning/builders';
import { createClockFace } from './clockFace';
import { h, linked } from './dom';

const SUBJECT_CHIP: Record<Subject, string> = {
  english: '🔤 영어단어',
  hanja: '漢 한자',
  math: '🔢 수학',
  clock: '🕒 시계',
  manners: '🙇 예절',
};
const PLACE: Record<QuizPlacement, string> = {
  gate: '🚪 지혜의 문',
  boss: '⚡ 약점 공격!',
  npc: '💬 대화',
  shrine: '🦉 부엉이 신전',
  story: '📖 이야기',
};
const PRAISE = ['딩동댕! 🎉', '정답이에요! ⭐', '멋져요! 👏', '최고예요! 🌟', '훌륭해요! 🦉'];
/** 문제에 힌트가 없을 때 과목별 기본 힌트 */
const DEFAULT_HINT: Record<Subject, string> = {
  english: '그림을 잘 보고 소리 내어 읽어 봐요.',
  hanja: '한자의 모양을 잘 살펴봐요.',
  math: '손가락이나 그림으로 하나씩 세어 볼까요?',
  clock: '짧은 바늘이 시, 긴 바늘이 분이에요.',
  manners: '내가 그 사람이라면 어떤 말이 기쁠까요?',
};
const TRY_AGAIN = ['앗, 다시 생각해 볼까요?', '괜찮아요, 한 번 더!', '거의 다 왔어요!'];

export interface QuizSounds {
  correct(): void;
  wrong(): void;
  click(): void;
}

const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const isHanjaGlyph = (s: string) => /^[㐀-鿿]+$/.test(s);

export class QuizUI implements QuizPresenter {
  private ac = new AbortController();

  constructor(private root: HTMLElement, private sounds: QuizSounds) {}

  /** 열린 퀴즈를 모두 닫는다 (기다리던 쪽은 더 진행되지 않음) */
  abortAll() {
    this.ac.abort();
    this.ac = new AbortController();
    this.root.querySelectorAll('.quiz-backdrop').forEach((el) => el.remove());
  }

  present(q: Question, ctx: PresentContext): Promise<{ firstTry: boolean; tries: number }> {
    const signal = this.ac.signal;
    const local = linked(signal);
    return new Promise((resolve) => {
      const card = h('div', { class: `quiz-card ${q.subject}`, role: 'dialog', 'aria-label': `${SUBJECT_CHIP[q.subject]} 문제` });
      const backdrop = h('div', { class: 'quiz-backdrop' }, card);
      const bubble = h('p', { class: 'bubble' });
      const next = h('div', { class: 'quiz-next' });
      const answers = h('div', { class: 'quiz-answers' });
      let tries = 0;
      let finished = false;

      card.append(
        h(
          'div',
          { class: 'quiz-top' },
          h('span', { class: 'chip', text: SUBJECT_CHIP[q.subject] }),
          h('span', { class: 'where', text: PLACE[ctx.placement] }),
          ctx.total > 1 ? h('span', { class: 'count', text: `${ctx.index + 1} / ${ctx.total}` }) : null,
        ),
        h('div', { class: 'quiz-prompt', text: q.prompt }),
      );
      const visual = h('div', { class: 'quiz-visual' });
      if (q.clock) visual.append(createClockFace(q.clock).el);
      else if (q.emoji) visual.append(h('span', { class: isHanjaGlyph(q.emoji) ? 'glyph' : 'emoji', text: q.emoji }));
      if (visual.childElementCount && q.kind !== 'clockSet') card.append(visual);
      card.append(answers, h('div', { class: 'quiz-owl' }, h('span', { class: 'owl', text: '🦉' }), bubble), next);
      this.root.append(backdrop);

      const say = (text: string, tone: 'good' | 'try' | '' = '') => {
        bubble.textContent = text;
        bubble.className = `bubble ${tone}`;
      };
      const close = (firstTry: boolean) => {
        if (signal.aborted) return;
        local.abort();
        backdrop.remove();
        resolve({ firstTry, tries });
      };
      const onKey = (fn: (e: KeyboardEvent) => void) => {
        window.addEventListener('keydown', fn, { capture: true, signal: local.signal });
      };
      const continueButton = (label: string, firstTry: boolean, autoMs?: number) => {
        const b = h('button', { class: 'btn', type: 'button', text: label });
        let done = false;
        const go = () => {
          if (done || signal.aborted) return;
          done = true;
          this.sounds.click();
          close(firstTry);
        };
        b.addEventListener('click', go);
        onKey((e) => {
          if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
            e.preventDefault();
            e.stopPropagation();
            go();
          }
        });
        next.replaceChildren(b);
        b.focus();
        if (autoMs) setTimeout(go, autoMs);
      };
      /** 정답 */
      const correct = () => {
        finished = true;
        this.sounds.correct();
        say(`${pick(PRAISE)}${q.explain ? `  ${q.explain}` : ''}`, 'good');
        continueButton('좋아요! ▶', tries === 1, tries === 1 ? (q.explain && q.explain.length > 20 ? 3200 : 1600) : undefined);
      };
      /** 오답 — 첫 번째는 힌트, 두 번째는 정답 공개 */
      const wrong = (reveal: () => void, retry?: () => void) => {
        this.sounds.wrong();
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        if (tries >= 2) {
          finished = true;
          reveal();
          say(`정답은 '${answerText(q)}' 이에요. ${q.explain ?? ''}`, 'try');
          continueButton('알겠어요!', false);
        } else {
          retry?.();
          say(`${pick(TRY_AGAIN)} ${q.hint ?? DEFAULT_HINT[q.subject]}`, 'try');
        }
      };

      switch (q.kind) {
        case 'choice': this.choice(q, answers, correct, wrong, () => finished, () => ++tries, onKey); break;
        case 'number': this.number(q, answers, correct, wrong, () => finished, () => ++tries, onKey); break;
        case 'clockSet': this.clockSet(q, answers, correct, wrong, () => finished, () => ++tries); break;
        case 'spell': this.spell(q, answers, correct, wrong, () => finished, () => ++tries, onKey); break;
        case 'order': this.order(q, answers, correct, wrong, () => finished, () => ++tries); break;
      }
    });
  }

  private choice(
    q: ChoiceQuestion, box: HTMLElement, correct: () => void, wrong: (reveal: () => void) => void,
    isDone: () => boolean, tick: () => number, onKey: (fn: (e: KeyboardEvent) => void) => void,
  ) {
    const long = q.choices.some((c) => [...c].length > 9);
    const glyph = q.choices.every((c) => isHanjaGlyph(c) && [...c].length === 1);
    box.className = `quiz-answers${!long && q.choices.length % 2 === 0 ? ' grid2' : ''}`;
    const buttons = q.choices.map((c, i) =>
      h('button', { class: `answer${long ? ' long' : ''}${glyph ? ' glyph' : ''}`, type: 'button' }, h('span', { class: 'num', text: String(i + 1) }), c),
    );
    const submit = (i: number) => {
      if (isDone() || buttons[i].classList.contains('wrong')) return;
      tick();
      if (i === q.answerIndex) {
        buttons[i].classList.add('correct');
        correct();
      } else {
        buttons[i].classList.add('wrong');
        wrong(() => buttons[q.answerIndex].classList.add('correct'));
      }
    };
    buttons.forEach((b, i) => b.addEventListener('click', () => submit(i)));
    box.append(...buttons);
    onKey((e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= buttons.length) submit(n - 1);
    });
  }

  private number(
    q: NumberQuestion, box: HTMLElement, correct: () => void, wrong: (reveal: () => void, retry?: () => void) => void,
    isDone: () => boolean, tick: () => number, onKey: (fn: (e: KeyboardEvent) => void) => void,
  ) {
    let value = '';
    const display = h('div', { class: 'numpad-display', text: '?' });
    const render = () => { display.textContent = value || '?'; };
    const press = (k: string) => {
      if (isDone()) return;
      this.sounds.click();
      if (k === '⌫') value = value.slice(0, -1);
      else if (k === '✔') {
        if (!value) return;
        tick();
        if (Number(value) === q.answer) correct();
        else wrong(() => { value = String(q.answer); render(); display.style.color = '#16a34a'; }, () => { value = ''; render(); });
        return;
      } else if (value.length < 4) value = value === '0' ? k : value + k;
      render();
    };
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✔'];
    const pad = h('div', { class: 'numpad' }, ...keys.map((k) => h('button', { class: `answer${k === '✔' ? ' ok' : ''}`, type: 'button', text: k, onclick: () => press(k) })));
    box.append(display, pad);
    onKey((e) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('⌫');
      else if (e.key === 'Enter') { e.preventDefault(); press('✔'); }
    });
  }

  private clockSet(
    q: ClockSetQuestion, box: HTMLElement, correct: () => void, wrong: (reveal: () => void) => void,
    isDone: () => boolean, tick: () => number,
  ) {
    const face = createClockFace({ h: 12, m: 0 }, { snapMinutes: q.snapMinutes });
    const step = (dh: number, dm: number) => {
      if (isDone()) return;
      this.sounds.click();
      const t = face.get();
      let hh = t.h + dh;
      let mm = t.m + dm;
      if (mm < 0) mm += 60;
      if (mm >= 60) mm -= 60;
      if (hh < 1) hh += 12;
      if (hh > 12) hh -= 12;
      face.set({ h: hh, m: mm });
    };
    const stepper = (label: string, minus: () => void, plus: () => void) =>
      h('div', { class: 'stepper' },
        h('button', { class: 'btn gray small', type: 'button', text: '◀', onclick: minus }),
        label,
        h('button', { class: 'btn gray small', type: 'button', text: '▶', onclick: plus }));
    const ok = h('button', { class: 'btn', type: 'button', text: '이 시각이에요! ✔' });
    ok.addEventListener('click', () => {
      if (isDone()) return;
      tick();
      const t = face.get();
      if (t.h === q.answer.h && t.m === q.answer.m) correct();
      else wrong(() => face.set(q.answer));
    });
    box.append(
      h('div', { class: 'clock-wrap' },
        face.el,
        h('div', { class: 'clock-legend', html: '<b class="h">짧은 바늘</b> = 시 · <b class="m">긴 바늘</b> = 분 · 바늘을 끌어 보세요' }),
        h('div', { class: 'clock-steppers' },
          stepper('시', () => step(-1, 0), () => step(1, 0)),
          stepper('분', () => step(0, -q.snapMinutes), () => step(0, q.snapMinutes))),
        ok),
    );
  }

  private spell(
    q: SpellQuestion, box: HTMLElement, correct: () => void, wrong: (reveal: () => void, retry?: () => void) => void,
    isDone: () => boolean, tick: () => number, onKey: (fn: (e: KeyboardEvent) => void) => void,
  ) {
    const n = q.answer.length;
    const filled: (number | null)[] = Array(n).fill(null);
    const slots = Array.from({ length: n }, () => h('span'));
    const tiles = q.tiles.map((t) => h('button', { class: 'answer', type: 'button', text: t }));
    const render = () => {
      slots.forEach((s, i) => {
        const ti = filled[i];
        s.textContent = ti === null ? '' : q.tiles[ti];
        s.classList.toggle('filled', ti !== null);
      });
      tiles.forEach((t, i) => t.classList.toggle('used', filled.includes(i)));
    };
    const check = () => {
      if (filled.some((f) => f === null)) return;
      tick();
      const word = filled.map((i) => q.tiles[i!]).join('');
      if (word === q.answer) correct();
      else {
        wrong(
          () => {
            const used = new Set<number>();
            [...q.answer].forEach((ch, i) => {
              const ti = q.tiles.findIndex((t, k) => t === ch && !used.has(k));
              used.add(ti);
              filled[i] = ti;
            });
            render();
          },
          () => { filled.fill(null); render(); },
        );
      }
    };
    const place = (ti: number) => {
      if (isDone() || filled.includes(ti)) return;
      const at = filled.indexOf(null);
      if (at < 0) return;
      this.sounds.click();
      filled[at] = ti;
      render();
      check();
    };
    tiles.forEach((t, i) => t.addEventListener('click', () => place(i)));
    slots.forEach((s, i) => s.addEventListener('click', () => {
      if (isDone() || filled[i] === null) return;
      filled[i] = null;
      render();
    }));
    box.append(h('div', { class: 'spell-slots' }, ...slots), h('div', { class: 'spell-tiles' }, ...tiles));
    onKey((e) => {
      if (e.key === 'Backspace') {
        const last = filled.map((f, i) => (f === null ? -1 : i)).filter((i) => i >= 0).pop();
        if (last !== undefined) { filled[last] = null; render(); }
        return;
      }
      if (e.key.length !== 1) return;
      const ti = q.tiles.findIndex((t, i) => t === e.key.toLowerCase() && !filled.includes(i));
      if (ti >= 0) place(ti);
    });
  }

  private order(
    q: OrderQuestion, box: HTMLElement, correct: () => void, wrong: (reveal: () => void, retry?: () => void) => void,
    isDone: () => boolean, tick: () => number,
  ) {
    const picks: number[] = [];
    const buttons = q.items.map((it) => h('button', { class: 'answer', type: 'button' }, h('span', { class: 'badge', text: '' }), it));
    const render = () => {
      buttons.forEach((b, i) => {
        const at = picks.indexOf(i);
        b.classList.toggle('picked', at >= 0);
        (b.firstChild as HTMLElement).textContent = at >= 0 ? String(at + 1) : '';
      });
    };
    buttons.forEach((b, i) => b.addEventListener('click', () => {
      if (isDone()) return;
      this.sounds.click();
      const at = picks.indexOf(i);
      if (at >= 0) picks.splice(at);
      else picks.push(i);
      render();
      if (picks.length === q.items.length) {
        tick();
        if (picks.every((p, k) => p === q.answerOrder[k])) correct();
        else wrong(() => { picks.splice(0, picks.length, ...q.answerOrder); render(); }, () => { picks.length = 0; render(); });
      }
    }));
    box.className = 'order-list';
    box.append(...buttons);
  }
}
