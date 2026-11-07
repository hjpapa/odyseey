// [수용 테스트 — Codex A1] npm run test:accept -- tests/learning
import { describe, expect, it } from 'vitest';
import { englishWords, hanjaList, mannersScenes } from '../../src/learning/data';
import { ENGLISH_TOPICS, MANNERS_CATEGORIES, type ChapterId } from '../../src/types/contracts';

const share = <T>(xs: T[], pred: (x: T) => boolean) => xs.filter(pred).length / Math.max(1, xs.length);

/** 한국어문회 8급 50자 */
const HANJA_8GEUP = [...'校敎九國軍金南女年大東六萬母木門民白父北四山三生西先小水室十五王外月二人日一長弟中靑寸七土八學韓兄火'];
/** 스토리 장면에 쓰이는 한자 (8급 밖의 글자 포함) */
const STORY_HANJA = [...'家父母兄弟人大小日月山水木土門'];
const STORY_WORDS = ['sea', 'wave', 'boat', 'wind', 'sheep', 'eye', 'pig', 'lion', 'wolf', 'sun', 'cow', 'bow', 'home', 'king', 'queen', 'island', 'flower', 'cave', 'ship', 'star'];
/** STORY.md 에서 '예절'을 배우는 장 */
const MANNERS_CHAPTERS: ChapterId[] = ['ch01', 'ch05', 'ch08', 'ch11', 'ch12', 'ch15', 'ch17'];

describe('A1 영어단어', () => {
  it('300개 이상', () => expect(englishWords.length).toBeGreaterThanOrEqual(300));
  it('학년마다 25% 이상', () => {
    for (const g of [1, 2, 3]) expect(share(englishWords, (w) => w.grade === g), `${g}학년 비율`).toBeGreaterThanOrEqual(0.25);
  });
  it('주제마다 15개 이상', () => {
    for (const t of ENGLISH_TOPICS) expect(englishWords.filter((w) => w.topic === t).length, `topic ${t}`).toBeGreaterThanOrEqual(15);
  });
  it('스토리 단어가 모두 있다', () => {
    const words = new Set(englishWords.map((w) => w.word));
    expect(STORY_WORDS.filter((w) => !words.has(w))).toEqual([]);
  });
  it('3학년 단어는 모두 예문이 있다', () => {
    expect(englishWords.filter((w) => w.grade === 3 && !w.sentence).map((w) => w.id)).toEqual([]);
  });
});

describe('A1 한자', () => {
  it('8급 50자가 모두 8급으로 들어 있다', () => {
    const missing = HANJA_8GEUP.filter((c) => !hanjaList.some((h) => h.char === c && h.level === '8급'));
    expect(missing).toEqual([]);
  });
  it('7급II·7급 30자 이상', () => {
    expect(hanjaList.filter((h) => h.level !== '8급').length).toBeGreaterThanOrEqual(30);
  });
  it('스토리 한자가 모두 있다', () => {
    expect(STORY_HANJA.filter((c) => !hanjaList.some((h) => h.char === c))).toEqual([]);
  });
});

describe('A1 예절', () => {
  it('60개 이상', () => expect(mannersScenes.length).toBeGreaterThanOrEqual(60));
  it('분류마다 4개 이상', () => {
    for (const c of MANNERS_CATEGORIES) expect(mannersScenes.filter((m) => m.category === c).length, `category ${c}`).toBeGreaterThanOrEqual(4);
  });
  it('학년마다 25% 이상', () => {
    for (const g of [1, 2, 3]) expect(share(mannersScenes, (m) => m.grade === g), `${g}학년 비율`).toBeGreaterThanOrEqual(0.25);
  });
  it('정답 위치가 한쪽에 몰리지 않는다 (각 20% 이상)', () => {
    for (const i of [0, 1, 2]) expect(share(mannersScenes, (m) => m.answerIndex === i), `answerIndex ${i}`).toBeGreaterThanOrEqual(0.2);
  });
  it('예절을 배우는 장마다 장면이 1개 이상', () => {
    const missing = MANNERS_CHAPTERS.filter((c) => !mannersScenes.some((m) => m.chapterHint?.includes(c)));
    expect(missing).toEqual([]);
  });
});
