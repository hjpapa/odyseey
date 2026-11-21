/** 메뉴 화면들: 타이틀, 학년 고르기, 멈춤·설정(+보호자 모드), 장 완료, 준비 중, 확인 */
import type { Grade } from '../types/contracts';
import type { ParentReport } from '../game/parentReport';
import { prefs, setPref, type Prefs } from '../game/prefs';
import { formatPlayTime } from '../game/progress';
import { h, sleep } from './dom';

const TIME_LIMITS = [0, 20, 30, 40] as const;

export class Screens {
  private fadeEl = h('div', { class: 'fade' });
  private flashEl = h('div', { class: 'flash' });

  constructor(private root: HTMLElement) {
    root.append(this.flashEl, this.fadeEl);
  }

  async fade(on: boolean, ms = 400) {
    this.fadeEl.style.transitionDuration = `${ms}ms`;
    this.fadeEl.classList.toggle('on', on);
    await sleep(ms);
  }

  flash() {
    if (prefs.calm) return;
    this.flashEl.classList.remove('go');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('go');
  }

  title(opts: {
    continueLabel: string | null;
    build: string;
    onStart(): void;
    onContinue(): void;
    onSettings(): void;
    onMap?: () => void;
    onWardrobe?: () => void;
  }): () => void {
    const start = h('button', { class: `btn ${opts.continueLabel ? 'gray' : ''}`, type: 'button', text: opts.continueLabel ? '🆕 처음부터' : '⛵ 모험 시작' });
    const cont = opts.continueLabel ? h('button', { class: 'btn', type: 'button', text: `⛵ 이어하기 · ${opts.continueLabel}` }) : null;
    const map = opts.onMap ? h('button', { class: 'btn blue small', type: 'button', text: '🗺️ 지도', onclick: opts.onMap }) : null;
    const wardrobe = opts.onWardrobe ? h('button', { class: 'btn gold small', type: 'button', text: '🎽 꾸미기', onclick: opts.onWardrobe }) : null;
    const settings = h('button', { class: 'btn gray small', type: 'button', text: '⚙️ 설정' });
    start.addEventListener('click', opts.onStart);
    cont?.addEventListener('click', opts.onContinue);
    settings.addEventListener('click', opts.onSettings);
    const el = h(
      'div',
      { class: 'screen clear title-screen' },
      h('header', {}, h('p', { class: 'kicker', text: '아이가 쓴 17장의 이야기' }), h('h1', { text: '오디세이' }), h('p', { class: 'sub', text: '집으로 가는 길' })),
      h('div', { class: 'menu' }, cont, h('div', { class: 'row' }, start, map, wardrobe, settings), h('footer', { class: 'build', text: opts.build })),
    );
    this.root.append(el);
    (cont ?? start).focus();
    return () => el.remove();
  }

  gradeSelect(current?: Grade): Promise<Grade | null> {
    return new Promise((resolve) => {
      const done = (g: Grade | null) => {
        el.remove();
        resolve(g);
      };
      const buttons = ([1, 2, 3] as Grade[]).map((g) =>
        h('button', { class: `btn ${g === current ? 'gold' : 'blue'}`, type: 'button', text: `${g}학년`, onclick: () => done(g) }),
      );
      const el = h(
        'div',
        { class: 'screen dim' },
        h(
          'div',
          { class: 'card' },
          h('div', { class: 'big-emoji', text: '🦉' }),
          h('h2', { text: '몇 학년이에요?' }),
          h('p', { text: '학년에 맞는 문제를 낼게요. 나중에 언제든 바꿀 수 있어요.' }),
          h('div', { class: 'grade-buttons' }, ...buttons),
          current ? h('div', { class: 'row' }, h('button', { class: 'btn gray small', type: 'button', text: '닫기', onclick: () => done(null) })) : null,
        ),
      );
      this.root.append(el);
      buttons[(current ?? 1) - 1].focus();
    });
  }

  confirm(text: string, yes = '네', no = '아니요'): Promise<boolean> {
    return new Promise((resolve) => {
      const done = (v: boolean) => {
        el.remove();
        resolve(v);
      };
      const noBtn = h('button', { class: 'btn gray', type: 'button', text: no, onclick: () => done(false) });
      const el = h(
        'div',
        { class: 'screen dim' },
        h('div', { class: 'card' }, h('p', { text }), h('div', { class: 'row' }, noBtn, h('button', { class: 'btn', type: 'button', text: yes, onclick: () => done(true) }))),
      );
      this.root.append(el);
      noBtn.focus();
    });
  }

  settings(opts: {
    grade: Grade | null;
    volumes: { master: number; sfx: number; bgm: number };
    onVolume(ch: 'master' | 'sfx' | 'bgm', v: number): void;
    onGrade(g: Grade): void;
    extra?: { label: string; onClick(): void }[];
    resumeLabel?: string;
    /** 조작 안내를 바꿀 때 (바다 장처럼 조작이 다른 곳) — [터치, 키보드] */
    help?: [string, string];
    /** 보호자 모드 (어른 확인 문제를 풀어야 열린다) */
    parent?: { report(): ParentReport; onTimeLimit(min: number): void };
  }): Promise<void> {
    return new Promise((resolve) => {
      let view: 'main' | 'gate' | 'parent' = 'main';
      const close = () => {
        window.removeEventListener('keydown', onKey, true);
        el.remove();
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        const typing = (e.target as HTMLElement | null)?.tagName === 'INPUT' && (e.target as HTMLInputElement).type === 'text';
        if (e.code === 'Escape' || (e.code === 'KeyP' && !typing)) {
          e.preventDefault();
          e.stopPropagation();
          if (e.repeat) return;
          if (view === 'main') close();
          else showMain();
          return;
        }
        const target = e.target as HTMLElement | null;
        if (['Space', 'Enter', 'NumpadEnter'].includes(e.code) && target?.tagName === 'BUTTON' && el.contains(target)) {
          e.preventDefault();
          e.stopPropagation();
          if (!e.repeat) target.click();
        }
      };
      window.addEventListener('keydown', onKey, true);
      const slider = (label: string, ch: 'master' | 'sfx' | 'bgm') => {
        const input = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: opts.volumes[ch], 'aria-label': label }) as HTMLInputElement;
        input.addEventListener('input', () => opts.onVolume(ch, Number(input.value)));
        return h('div', { class: 'settings-row' }, h('span', { text: label }), input);
      };
      const toggle = (label: string, key: keyof Prefs) => {
        const b = h('button', { class: 'btn gray small toggle', type: 'button', role: 'switch', 'aria-label': label });
        const paint = () => {
          b.textContent = prefs[key] ? '켜짐' : '꺼짐';
          b.classList.toggle('on', prefs[key]);
          b.setAttribute('aria-checked', String(prefs[key]));
        };
        b.addEventListener('click', () => { setPref(key, !prefs[key]); paint(); });
        paint();
        return h('div', { class: 'settings-row' }, h('span', { text: label }), b);
      };
      let gradeRow: HTMLElement | null = null;
      if (opts.grade) {
        const seg = h('div', { class: 'seg' });
        const renderSeg = (g: Grade) => {
          seg.replaceChildren(...([1, 2, 3] as Grade[]).map((x) =>
            h('button', { class: `btn gray small${x === g ? ' on' : ''}`, type: 'button', text: `${x}학년`, onclick: () => { opts.onGrade(x); renderSeg(x); } })));
        };
        renderSeg(opts.grade);
        gradeRow = h('div', { class: 'settings-row' }, h('span', { text: '학년' }), seg);
      }
      const resume = h('button', { class: 'btn', type: 'button', text: opts.resumeLabel ?? '계속하기 ▶', onclick: close });
      const extras = (opts.extra ?? []).map((x) => h('button', { class: 'btn gray small', type: 'button', text: x.label, onclick: () => { close(); x.onClick(); } }));
      const parentBtn = opts.parent ? h('button', { class: 'btn gray small', type: 'button', text: '👪 보호자', onclick: () => showGate() }) : null;
      const mainView = [
        h('h2', { text: '⚙️ 설정' }),
        gradeRow,
        slider('🔊 전체 소리', 'master'),
        slider('🎵 배경음', 'bgm'),
        slider('💥 효과음', 'sfx'),
        toggle('🔠 큰 글씨', 'bigText'),
        toggle('🌙 번쩍임·흔들림 줄이기', 'calm'),
        h('p', {
          class: 'settings-help',
          text: document.documentElement.classList.contains('touch-mode')
            ? opts.help?.[0] ?? '조작: 왼쪽을 끌어 이동 · ⚔️ 공격 · ⤴️ 점프 · 🌀 구르기 · ✋ 말하기 · 오른쪽을 끌어 카메라'
            : opts.help?.[1] ?? '조작: WASD 이동 · Space 점프 · J/클릭 공격 · Shift 구르기 · E 말하기 · 오른쪽 드래그 카메라',
        }),
        h('div', { class: 'row' }, parentBtn, ...extras, resume),
      ];
      const card = h('div', { class: 'card' }, ...mainView);
      const el = h('div', { class: 'screen dim' }, card);

      function showMain() {
        view = 'main';
        card.classList.remove('parent');
        card.replaceChildren(...mainView.filter((x): x is HTMLElement => !!x));
        (parentBtn ?? resume).focus();
      }

      // 어른 확인: 두 자리 × 한 자리 곱셈 (1~3학년은 아직 어려운 문제)
      function showGate() {
        view = 'gate';
        const a = 12 + Math.floor(Math.random() * 8);
        const b = 3 + Math.floor(Math.random() * 7);
        const input = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': '답', class: 'gate-input' }) as HTMLInputElement;
        const msg = h('p', { class: 'gate-msg', 'aria-live': 'polite' });
        const check = () => {
          if (Number(input.value.trim()) === a * b) showParent();
          else {
            msg.textContent = '다시 확인해 주세요.';
            input.value = '';
            input.focus();
          }
        };
        input.addEventListener('keydown', (e) => {
          if (e.code === 'Enter' || e.code === 'NumpadEnter') {
            e.preventDefault();
            check();
          }
        });
        card.replaceChildren(
          h('h2', { text: '👪 보호자 확인' }),
          h('p', { text: '어른이 풀어 주세요.' }),
          h('p', { class: 'gate-q', text: `${a} × ${b} = ?` }),
          input,
          msg,
          h('div', { class: 'row' },
            h('button', { class: 'btn gray small', type: 'button', text: '취소', onclick: () => showMain() }),
            h('button', { class: 'btn small', type: 'button', text: '확인', onclick: check })),
        );
        input.focus();
      }

      function showParent() {
        if (!opts.parent) return;
        view = 'parent';
        const r = opts.parent.report();
        card.classList.add('parent');
        const scoreRows = r.subjects.map((s) => {
          const pct = s.total ? Math.round((s.firstTry / s.total) * 100) : 0;
          return h('div', { class: 'report-row' },
            h('span', { text: s.label }),
            h('span', { class: 'report-bar' }, h('i', { style: { width: `${pct}%` } })),
            h('b', { text: s.total ? `${s.firstTry}/${s.total} (${pct}%)` : '아직 없음' }));
        });
        const seg = h('div', { class: 'seg' });
        const renderSeg = (cur: number) => {
          seg.replaceChildren(...TIME_LIMITS.map((m) => h('button', {
            class: `btn gray small${m === cur ? ' on' : ''}`,
            type: 'button',
            text: m ? `${m}분` : '끄기',
            onclick: () => { opts.parent?.onTimeLimit(m); renderSeg(m); },
          })));
        };
        renderSeg(r.timeLimit);
        const back = h('button', { class: 'btn small', type: 'button', text: '닫기', onclick: () => showMain() });
        card.replaceChildren(
          h('h2', { text: '👪 보호자 모드' }),
          h('p', { text: `${r.grade}학년 · 이야기 ${r.completed}/${r.totalChapters}장 · 🫒 ${r.coins}` }),
          h('p', { text: `⏱️ 모두 ${formatPlayTime(r.playSeconds)} · 이번에 ${formatPlayTime(r.sessionSeconds)}` }),
          h('h3', { text: '과목별로 한 번에 맞힌 비율' }),
          ...scoreRows,
          h('h3', { text: '최근에 틀린 문제' }),
          r.missed.length
            ? h('ul', { class: 'missed' }, ...r.missed.map((m) => h('li', { text: m })))
            : h('p', { text: '아직 틀린 문제가 없어요. 👏' }),
          h('h3', { text: '⏰ 한 번에 놀 시간 알림' }),
          h('p', { class: 'note', text: '시간이 되면 알려 주고, 장을 마칠 때 쉬자고 권해요.' }),
          seg,
          h('div', { class: 'row' }, back),
        );
        back.focus();
      }

      this.root.append(el);
      resume.focus();
    });
  }

  chapterComplete(opts: {
    no: number;
    title: string;
    coins: number;
    correct: number;
    total: number;
    hasNext: boolean;
    /** 다음 버튼 글자 (예: 마지막 장의 '🎬 엔딩 보기') */
    nextLabel?: string;
    /** 보호자가 정한 놀이 시간이 다 됐으면 쉬자고 권한다 */
    rest?: boolean;
    /** 이야기책에 더해진 한 장 — 아이가 쓴 그 장의 문장 (엔딩 이야기책으로 이어진다) */
    story?: { emoji: string; text: string; pages: number; total: number };
  }): Promise<'next' | 'map' | 'title'> {
    return new Promise((resolve) => {
      const done = (v: 'next' | 'map' | 'title') => {
        el.remove();
        resolve(v);
      };
      const next = h('button', {
        class: `btn${opts.rest ? ' gray' : ''}`,
        type: 'button',
        text: opts.nextLabel ?? (opts.hasNext ? '다음 장으로 ▶' : '확인'),
        onclick: () => done('next'),
      });
      const rest = opts.rest ? h('button', { class: 'btn gold', type: 'button', text: '🏠 오늘은 여기까지', onclick: () => done('title') }) : null;
      const el = h(
        'div',
        { class: 'screen dim' },
        h(
          'div',
          { class: 'card' },
          h('div', { class: 'big-emoji', text: '🏆' }),
          h('h2', { text: `${opts.no}장 「${opts.title}」 완료!` }),
          opts.story
            ? h('div', { class: 'story-earned' },
                h('div', { class: 'story-earned-head', text: `📖 이야기책 ${opts.story.pages} / ${opts.story.total}장` }),
                h('p', { class: 'story-earned-text' }, h('span', { 'aria-hidden': 'true', text: `${opts.story.emoji} ` }), opts.story.text))
            : null,
          h('p', { text: `🫒 올리브잎 +${opts.coins}` }),
          opts.total > 0
            ? h('p', {
                text: opts.correct > 0
                  ? `🦉 문제 ${opts.total}개 중 ${opts.correct}개를 한 번에 맞혔어요!`
                  : `🦉 문제 ${opts.total}개를 끝까지 풀었어요! 다음엔 한 번에 맞혀 봐요!`,
              })
            : null,
          opts.rest ? h('p', { class: 'rest-note', text: '⏰ 약속한 놀이 시간이 다 됐어요. 오늘은 여기까지 할까요?' }) : null,
          h('div', { class: 'row' }, h('button', { class: 'btn gray small', type: 'button', text: '🗺️ 지도', onclick: () => done('map') }), next, rest),
        ),
      );
      this.root.append(el);
      (rest ?? next).focus();
    });
  }

  comingSoon(no: number, title?: string): Promise<void> {
    return new Promise((resolve) => {
      const ok = h('button', { class: 'btn', type: 'button', text: '처음 화면으로', onclick: () => { el.remove(); resolve(); } });
      const el = h(
        'div',
        { class: 'screen dim' },
        h(
          'div',
          { class: 'card' },
          h('div', { class: 'big-emoji', text: '🛠️' }),
          h('h2', { text: `${no}장${title ? ` 「${title}」` : ''}은 준비 중이에요` }),
          h('p', { text: '다음 업데이트에서 이야기가 이어져요. 조금만 기다려 주세요!' }),
          h('div', { class: 'row' }, ok),
        ),
      );
      this.root.append(el);
      ok.focus();
    });
  }
}
