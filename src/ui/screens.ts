/** 메뉴 화면들: 타이틀, 학년 고르기, 멈춤, 장 완료, 준비 중, 확인 */
import type { Grade } from '../types/contracts';
import { h, sleep } from './dom';

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
    this.flashEl.classList.remove('go');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('go');
  }

  title(opts: { continueLabel: string | null; build: string; onStart(): void; onContinue(): void; onSettings(): void }): () => void {
    const start = h('button', { class: `btn ${opts.continueLabel ? 'gray' : ''}`, type: 'button', text: opts.continueLabel ? '🆕 처음부터' : '⛵ 모험 시작' });
    const cont = opts.continueLabel ? h('button', { class: 'btn', type: 'button', text: `⛵ 이어하기 · ${opts.continueLabel}` }) : null;
    const settings = h('button', { class: 'btn gray small', type: 'button', text: '⚙️ 설정' });
    start.addEventListener('click', opts.onStart);
    cont?.addEventListener('click', opts.onContinue);
    settings.addEventListener('click', opts.onSettings);
    const el = h(
      'div',
      { class: 'screen clear title-screen' },
      h('header', {}, h('p', { class: 'kicker', text: '아이가 쓴 17장의 이야기' }), h('h1', { text: '오디세이' }), h('p', { class: 'sub', text: '집으로 가는 길' })),
      h('div', { class: 'menu' }, cont, h('div', { class: 'row' }, start, settings), h('footer', { class: 'build', text: opts.build })),
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
  }): Promise<void> {
    return new Promise((resolve) => {
      const close = () => {
        window.removeEventListener('keydown', onKey, true);
        el.remove();
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      };
      window.addEventListener('keydown', onKey, true);
      const slider = (label: string, ch: 'master' | 'sfx' | 'bgm') => {
        const input = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: opts.volumes[ch], 'aria-label': label }) as HTMLInputElement;
        input.addEventListener('input', () => opts.onVolume(ch, Number(input.value)));
        return h('div', { class: 'settings-row' }, h('span', { text: label }), input);
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
      const el = h(
        'div',
        { class: 'screen dim' },
        h(
          'div',
          { class: 'card' },
          h('h2', { text: '⚙️ 설정' }),
          gradeRow,
          slider('🔊 전체 소리', 'master'),
          slider('🎵 배경음', 'bgm'),
          slider('💥 효과음', 'sfx'),
          h('p', { style: { fontSize: '15px', color: '#667' }, text: '조작: WASD 이동 · Space 점프 · J/클릭 공격 · Shift 구르기 · E 말하기 · 오른쪽 드래그 카메라' }),
          h('div', { class: 'row' }, ...extras, resume),
        ),
      );
      this.root.append(el);
      resume.focus();
    });
  }

  chapterComplete(opts: { no: number; title: string; coins: number; correct: number; total: number; hasNext: boolean }): Promise<'next' | 'title'> {
    return new Promise((resolve) => {
      const done = (v: 'next' | 'title') => {
        el.remove();
        resolve(v);
      };
      const next = h('button', { class: 'btn', type: 'button', text: opts.hasNext ? '다음 장으로 ▶' : '확인', onclick: () => done('next') });
      const el = h(
        'div',
        { class: 'screen dim' },
        h(
          'div',
          { class: 'card' },
          h('div', { class: 'big-emoji', text: '🏆' }),
          h('h2', { text: `${opts.no}장 「${opts.title}」 완료!` }),
          h('p', { text: `🫒 올리브잎 +${opts.coins}` }),
          opts.total > 0
            ? h('p', {
                text: opts.correct > 0
                  ? `🦉 문제 ${opts.total}개 중 ${opts.correct}개를 한 번에 맞혔어요!`
                  : `🦉 문제 ${opts.total}개를 끝까지 풀었어요! 다음엔 한 번에 맞혀 봐요!`,
              })
            : null,
          h('div', { class: 'row' }, h('button', { class: 'btn gray', type: 'button', text: '처음 화면', onclick: () => done('title') }), next),
        ),
      );
      this.root.append(el);
      next.focus();
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
