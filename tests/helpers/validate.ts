/**
 * 데이터·모듈 검증 도우미. 각 함수는 오류 메시지 배열을 돌려준다 (빈 배열 = 통과).
 * 테스트 실패 메시지가 곧 Codex 에게 주는 수정 지시가 되도록 구체적으로 적는다.
 */
import { Mesh, type Group, type Object3D } from 'three';
import {
  ATTACH_POINTS, BGM_IDS, BOSS_IDS, CHAPTER_IDS, CREATURE_IDS, CREATURE_PART_HINTS,
  ENGLISH_TOPICS, HANJA_LEVELS, HUMANOID_IDS, HUMANOID_PARTS, ISLAND_IDS,
  MANNERS_CATEGORIES, MODEL_HEIGHT_RANGE, PROP_IDS, SFX_IDS, SUBJECTS,
  type BgmTrack, type ChapterData, type CreatureId, type EnglishWord, type Hanja,
  type IslandLayout, type MannersScene, type ModelId, type Question, type ScaleMode,
  type XZ,
} from '../../src/types/contracts';
import { CHILD_STORY } from '../../src/story/childStory';
import { englishWords, hanjaList, mannersScenes } from '../../src/learning/data';

export const has = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);
export const len = (s: string) => [...s].length;
const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
const isStr = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0;
const GRADES = [1, 2, 3];
export const MODEL_IDS: readonly ModelId[] = [...HUMANOID_IDS, ...CREATURE_IDS, ...PROP_IDS];
const SPEAKERS: readonly string[] = ['narrator', ...HUMANOID_IDS, 'athenaOwl', 'dog'];

// ─── 학습 데이터 ────────────────────────────────────────────────

export function validateEnglish(w: EnglishWord): string[] {
  const e: string[] = [];
  const at = `english[${w.id}]`;
  if (!isStr(w.word) || w.word !== w.word.toLowerCase()) e.push(`${at}: word 는 소문자 영어`);
  if (w.id !== `en-${w.word?.replace(/ /g, '-')}`) e.push(`${at}: id 는 'en-${w.word}' 형식이어야 함`);
  if (!isStr(w.meaningKo)) e.push(`${at}: meaningKo 비어 있음`);
  if (!GRADES.includes(w.grade)) e.push(`${at}: grade 는 1|2|3`);
  if (!has(ENGLISH_TOPICS, w.topic)) e.push(`${at}: topic '${w.topic}' 은 ENGLISH_TOPICS 에 없음`);
  if (!isStr(w.emoji) || w.emoji.length > 12) e.push(`${at}: emoji 1개 필요`);
  if (w.sentence !== undefined && w.sentence.split(/\s+/).length > 6) e.push(`${at}: sentence 는 6단어 이내`);
  if ((w.sentence === undefined) !== (w.sentenceKo === undefined)) e.push(`${at}: sentence/sentenceKo 는 함께 있어야 함`);
  w.chapterHint?.forEach((c) => has(CHAPTER_IDS, c) || e.push(`${at}: chapterHint '${c}' 잘못됨`));
  return e;
}

export function validateHanja(h: Hanja): string[] {
  const e: string[] = [];
  const at = `hanja[${h.id}]`;
  if (len(h.char ?? '') !== 1) e.push(`${at}: char 는 한 글자`);
  if (h.id !== `hj-${h.char}`) e.push(`${at}: id 는 'hj-${h.char}' 형식`);
  if (!isStr(h.hun) || !isStr(h.eum)) e.push(`${at}: hun/eum 비어 있음`);
  if (!has(HANJA_LEVELS, h.level)) e.push(`${at}: level '${h.level}' 잘못됨`);
  if (!GRADES.includes(h.grade)) e.push(`${at}: grade 는 1|2|3`);
  if (!isInt(h.strokes) || h.strokes < 1 || h.strokes > 30) e.push(`${at}: strokes 잘못됨`);
  if (!Array.isArray(h.exampleWords) || h.exampleWords.length < 1 || h.exampleWords.length > 3) e.push(`${at}: exampleWords 1~3개`);
  h.exampleWords?.forEach((x) => {
    if (!x.hanja?.includes(h.char)) e.push(`${at}: 예시 '${x.hanja}' 에 '${h.char}' 가 없음`);
    if (len(x.reading ?? '') !== len(x.hanja ?? '')) e.push(`${at}: 예시 '${x.hanja}' 읽기 글자 수가 다름`);
    if (!isStr(x.meaning)) e.push(`${at}: 예시 뜻 비어 있음`);
  });
  h.chapterHint?.forEach((c) => has(CHAPTER_IDS, c) || e.push(`${at}: chapterHint '${c}' 잘못됨`));
  return e;
}

export function validateManners(m: MannersScene): string[] {
  const e: string[] = [];
  const at = `manners[${m.id}]`;
  if (!/^mn-\d{3}$/.test(m.id)) e.push(`${at}: id 는 'mn-000' 형식`);
  if (!GRADES.includes(m.grade)) e.push(`${at}: grade 는 1|2|3`);
  if (!has(MANNERS_CATEGORIES, m.category)) e.push(`${at}: category '${m.category}' 잘못됨`);
  if (!isStr(m.situation) || len(m.situation) > 50) e.push(`${at}: situation 은 50자 이내`);
  if (!isStr(m.emoji)) e.push(`${at}: emoji 필요`);
  if (!Array.isArray(m.choices) || m.choices.length !== 3) e.push(`${at}: choices 는 3개`);
  else {
    if (new Set(m.choices).size !== 3) e.push(`${at}: choices 중복`);
    m.choices.forEach((c) => (!isStr(c) || len(c) > 30) && e.push(`${at}: 보기 '${c}' 는 30자 이내`));
  }
  if (![0, 1, 2].includes(m.answerIndex)) e.push(`${at}: answerIndex 는 0|1|2`);
  if (!isStr(m.praise) || !isStr(m.hint)) e.push(`${at}: praise/hint 필요`);
  m.chapterHint?.forEach((c) => has(CHAPTER_IDS, c) || e.push(`${at}: chapterHint '${c}' 잘못됨`));
  return e;
}

export function uniqueIds(items: { id: string }[], label: string): string[] {
  const seen = new Set<string>();
  const e: string[] = [];
  for (const it of items) {
    if (seen.has(it.id)) e.push(`${label}: id '${it.id}' 중복`);
    seen.add(it.id);
  }
  return e;
}

// ─── 문제 ───────────────────────────────────────────────────────

export function validateQuestion(q: Question): string[] {
  const e: string[] = [];
  const at = `question[${q.id}]`;
  if (!isStr(q.id)) e.push(`question: id 비어 있음`);
  if (!has(SUBJECTS, q.subject)) e.push(`${at}: subject 잘못됨`);
  if (!GRADES.includes(q.grade)) e.push(`${at}: grade 잘못됨`);
  if (!isStr(q.prompt) || len(q.prompt) > 40) e.push(`${at}: prompt 는 40자 이내 ('${q.prompt}')`);
  if (q.prompt.includes('{') || q.prompt.includes('}')) e.push(`${at}: prompt 에 채워지지 않은 템플릿 '${q.prompt}'`);
  if (q.clock) {
    const { h, m } = q.clock;
    if (!isInt(h) || h < 1 || h > 12 || !isInt(m) || m < 0 || m > 59) e.push(`${at}: clock 시각 잘못됨`);
  }
  switch (q.kind) {
    case 'choice':
      if (q.choices.length < 2 || q.choices.length > 4) e.push(`${at}: 보기는 2~4개`);
      if (new Set(q.choices).size !== q.choices.length) e.push(`${at}: 보기 중복 ${JSON.stringify(q.choices)}`);
      if (!isInt(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= q.choices.length) e.push(`${at}: answerIndex 범위 밖`);
      break;
    case 'number':
      if (!isInt(q.answer) || q.answer < 0) e.push(`${at}: answer 는 0 이상 정수`);
      break;
    case 'clockSet': {
      const { h, m } = q.answer;
      if (!isInt(h) || h < 1 || h > 12 || !isInt(m) || m < 0 || m > 59) e.push(`${at}: answer 시각 잘못됨`);
      if (![1, 5, 30].includes(q.snapMinutes)) e.push(`${at}: snapMinutes 는 1|5|30`);
      else if (m % q.snapMinutes !== 0) e.push(`${at}: 정답 분(${m})이 snapMinutes(${q.snapMinutes}) 배수가 아님`);
      break;
    }
    case 'spell':
      for (const ch of q.answer) if (!q.tiles.includes(ch)) e.push(`${at}: tiles 에 '${ch}' 없음`);
      break;
    case 'order': {
      const sorted = [...q.answerOrder].sort((a, b) => a - b);
      if (sorted.some((v, i) => v !== i) || sorted.length !== q.items.length) e.push(`${at}: answerOrder 는 0..n-1 순열`);
      break;
    }
  }
  return e;
}

/** 수학 문제 id 'math:<op>:<a><기호><b>' 해석 */
export function parseMathId(id: string): { op: string; a: number; b: number } | null {
  const m = /^math:(add|sub|mul|div):(\d+)([+\-x/])(\d+)$/.exec(id);
  return m ? { op: m[1], a: Number(m[2]), b: Number(m[4]) } : null;
}

export function answerOf(q: Question): string {
  switch (q.kind) {
    case 'choice': return q.choices[q.answerIndex];
    case 'number': return String(q.answer);
    case 'clockSet': return `${q.answer.h}:${q.answer.m}`;
    case 'spell': return q.answer;
    case 'order': return q.answerOrder.join(',');
  }
}

// ─── 사운드 ─────────────────────────────────────────────────────

const NOTE_RE = /^([A-G])(#|b)?([0-8])$/;
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const MODE_STEPS: Record<ScaleMode, number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
};
export function pitchClass(name: string): number | null {
  const m = /^([A-G])(#|b)?/.exec(name);
  if (!m) return null;
  return (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
}

export function validateTrack(t: BgmTrack, key: string): string[] {
  const e: string[] = [];
  const at = `bgm[${key}]`;
  if (t.id !== key) e.push(`${at}: id '${t.id}' 가 키와 다름`);
  if (!has(BGM_IDS, t.id)) e.push(`${at}: BGM_IDS 에 없음`);
  if (!isStr(t.title)) e.push(`${at}: title 필요`);
  if (!(t.bpm >= 50 && t.bpm <= 180)) e.push(`${at}: bpm 50~180`);
  if (pitchClass(t.root) === null || !/^[A-G](#|b)?$/.test(t.root)) e.push(`${at}: root '${t.root}' 잘못됨`);
  if (!MODE_STEPS[t.mode]) e.push(`${at}: mode 잘못됨`);
  const ids = new Set(t.patterns.map((p) => p.id));
  if (t.sequence.length === 0) e.push(`${at}: sequence 비어 있음`);
  t.sequence.forEach((s) => ids.has(s) || e.push(`${at}: sequence 의 '${s}' 패턴 없음`));
  if (!isInt(t.loopFrom) || t.loopFrom < 0 || t.loopFrom >= t.sequence.length) e.push(`${at}: loopFrom 범위 밖`);
  for (const p of t.patterns) {
    const total = p.stepsPerBar * p.bars;
    if (!isInt(total) || total <= 0) e.push(`${at}/${p.id}: stepsPerBar*bars 잘못됨`);
    for (const l of p.layers) {
      for (const n of l.notes) {
        const where = `${at}/${p.id}/${l.instrument}@${n.step}`;
        if (!isInt(n.step) || n.step < 0 || n.step >= total) e.push(`${where}: step 범위 밖`);
        if (!(n.len >= 1) || n.step + n.len > total) e.push(`${where}: len 이 패턴을 넘음`);
        if (n.vel !== undefined && !(n.vel >= 0 && n.vel <= 1)) e.push(`${where}: vel 0~1`);
        if (l.instrument === 'drum') {
          if (!['kick', 'snare', 'hat', 'tom'].includes(n.note)) e.push(`${where}: drum note '${n.note}' 잘못됨`);
        } else if (!NOTE_RE.test(n.note)) e.push(`${where}: note '${n.note}' 잘못됨 (예: 'D4', 'F#3')`);
      }
    }
  }
  return e;
}

export function trackSeconds(t: BgmTrack): number {
  const stepSec = 60 / t.bpm / 4;
  return t.sequence.reduce((sum, id) => {
    const p = t.patterns.find((x) => x.id === id);
    return sum + (p ? p.stepsPerBar * p.bars * stepSec : 0);
  }, 0);
}

// ─── 모델 ───────────────────────────────────────────────────────

export function countMeshes(o: Object3D): number {
  let n = 0;
  o.traverse((c) => { if (c instanceof Mesh) n++; });
  return n;
}

export function validateModel(id: ModelId, g: Group): string[] {
  const e: string[] = [];
  const at = `model[${id}]`;
  const { height, radius } = (g.userData ?? {}) as { height?: number; radius?: number };
  if (!(typeof height === 'number' && height > 0)) e.push(`${at}: userData.height 필요`);
  if (!(typeof radius === 'number' && radius > 0)) e.push(`${at}: userData.radius 필요`);
  const range = MODEL_HEIGHT_RANGE[id];
  if (range && typeof height === 'number' && (height < range[0] || height > range[1])) {
    e.push(`${at}: 키 ${height} 가 기준 ${range[0]}~${range[1]} 밖`);
  }
  if (has(HUMANOID_IDS, id)) {
    for (const p of [...HUMANOID_PARTS, ...ATTACH_POINTS]) {
      if (!g.getObjectByName(p)) e.push(`${at}: 리그 부위 '${p}' 없음`);
    }
    const armL = g.getObjectByName('armL');
    const armR = g.getObjectByName('armR');
    if (armL && armR) {
      const l = armL.getWorldPosition(armL.position.clone().set(0, 0, 0));
      const r = armR.getWorldPosition(armR.position.clone().set(0, 0, 0));
      if (!(l.x > r.x)) e.push(`${at}: armL 은 +X 쪽(캐릭터의 왼쪽)이어야 함`);
    }
  }
  if (has(CREATURE_IDS, id)) {
    for (const p of CREATURE_PART_HINTS[id as CreatureId]) {
      if (!g.getObjectByName(p)) e.push(`${at}: 부위 '${p}' 없음`);
    }
  }
  return e;
}

// ─── 챕터 ───────────────────────────────────────────────────────

export function validateChapter(c: ChapterData, file: string): string[] {
  const e: string[] = [];
  const at = `chapter[${c.id}]`;
  if (!has(CHAPTER_IDS, c.id)) return [`${file}: id '${c.id}' 가 CHAPTER_IDS 에 없음`];
  if (!file.endsWith(`/${c.id}.json`)) e.push(`${at}: 파일 이름은 ${c.id}.json`);
  if (c.no !== CHAPTER_IDS.indexOf(c.id) + 1) e.push(`${at}: no 는 ${CHAPTER_IDS.indexOf(c.id) + 1}`);
  if (!isStr(c.title)) e.push(`${at}: title 필요`);
  if (c.titleCard?.childText !== CHILD_STORY[c.id]) {
    e.push(`${at}: titleCard.childText 가 아이 원문과 다름.\n  기대: ${CHILD_STORY[c.id]}\n  실제: ${c.titleCard?.childText}`);
  }
  if (!isStr(c.titleCard?.subtitle) || len(c.titleCard.subtitle) > 20) e.push(`${at}: subtitle 20자 이내`);
  if (c.memory !== (c.no >= 3 && c.no <= 11)) e.push(`${at}: memory 는 3~11장만 true`);
  if (!has(ISLAND_IDS, c.island)) e.push(`${at}: island '${c.island}' 잘못됨`);
  if (!has(BGM_IDS, c.bgm?.explore)) e.push(`${at}: bgm.explore 잘못됨`);
  if (c.bgm?.boss !== undefined && !has(BGM_IDS, c.bgm.boss)) e.push(`${at}: bgm.boss 잘못됨`);
  c.learning.forEach((s) => has(SUBJECTS, s) || e.push(`${at}: learning '${s}' 잘못됨`));
  if (c.boss !== undefined && !has(BOSS_IDS, c.boss)) e.push(`${at}: boss '${c.boss}' 잘못됨`);
  if (!isInt(c.reward?.coins) || c.reward.coins < 0) e.push(`${at}: reward.coins 필요`);

  e.push(...uniqueIds(c.quizSlots, `${at}.quizSlots`));
  e.push(...uniqueIds(c.objectives, `${at}.objectives`));
  e.push(...uniqueIds(c.scenes, `${at}.scenes`));
  const slotIds = new Set(c.quizSlots.map((s) => s.id));
  const objIds = new Set(c.objectives.map((o) => o.id));

  for (const s of c.quizSlots) {
    const w = `${at}.quizSlots[${s.id}]`;
    if (!has(SUBJECTS, s.subject)) e.push(`${w}: subject 잘못됨`);
    if (!['gate', 'boss', 'npc', 'shrine', 'story'].includes(s.placement)) e.push(`${w}: placement 잘못됨`);
    if (!isInt(s.count) || s.count < 1 || s.count > 5) e.push(`${w}: count 1~5`);
    const pool: Record<string, { id: string }[]> = { english: englishWords, hanja: hanjaList, manners: mannersScenes };
    s.ids?.forEach((id) => {
      if (!pool[s.subject]) e.push(`${w}: ids 는 english/hanja/manners 에서만`);
      else if (!pool[s.subject].some((x) => x.id === id)) e.push(`${w}: 학습 데이터에 '${id}' 없음`);
    });
    if (s.topic !== undefined) {
      const ok = (s.subject === 'english' && has(ENGLISH_TOPICS, s.topic)) || (s.subject === 'manners' && has(MANNERS_CATEGORIES, s.topic));
      if (!ok) e.push(`${w}: topic '${s.topic}' 은 ${s.subject} 에 쓸 수 없음`);
    }
    if (s.mathTemplate && (s.subject !== 'math' || !/\{a\}/.test(s.mathTemplate.text) || !/\{b\}/.test(s.mathTemplate.text))) {
      e.push(`${w}: mathTemplate 은 math 과목 + {a},{b} 포함`);
    }
    if (s.clockType && s.subject !== 'clock') e.push(`${w}: clockType 은 clock 과목만`);
  }

  for (const o of c.objectives) {
    const w = `${at}.objectives[${o.id}]`;
    if (!isStr(o.text) || len(o.text) > 20) e.push(`${w}: text 20자 이내 ('${o.text}')`);
    if (o.type === 'quiz' && !slotIds.has(o.target ?? '')) e.push(`${w}: quiz 목표의 target 은 quizSlot id`);
    if (o.type === 'boss' && !has(BOSS_IDS, o.target)) e.push(`${w}: boss 목표의 target 은 BossId`);
    if (['collect', 'defeat', 'rescue'].includes(o.type) && !(isInt(o.count) && o.count > 0)) e.push(`${w}: count 필요`);
    if (o.type === 'survive' && !(isInt(o.timeLimitSec) && o.timeLimitSec > 0)) e.push(`${w}: timeLimitSec 필요`);
  }

  for (const sc of c.scenes) {
    const w = `${at}.scenes[${sc.id}]`;
    const t = sc.trigger;
    if (t.on === 'objectiveDone' && !objIds.has(t.objective)) e.push(`${w}: trigger objective '${t.objective}' 없음`);
    if (sc.steps.length === 0) e.push(`${w}: steps 비어 있음`);
    for (const st of sc.steps) {
      if (st.type === 'line') {
        if (!SPEAKERS.includes(st.speaker)) e.push(`${w}: speaker '${st.speaker}' 잘못됨`);
        if (!isStr(st.text) || len(st.text) > 30) e.push(`${w}: 대사 30자 이내 ('${st.text}')`);
      } else if (st.type === 'caption') {
        if (!isStr(st.text) || len(st.text) > 40) e.push(`${w}: caption 40자 이내`);
      } else if (st.type === 'quiz') {
        if (!slotIds.has(st.slot)) e.push(`${w}: quiz slot '${st.slot}' 없음`);
      } else if (st.type === 'sfx') {
        if (!has(SFX_IDS, st.id)) e.push(`${w}: sfx '${st.id}' 잘못됨`);
      } else if (st.type === 'wait') {
        if (!(st.ms > 0 && st.ms <= 5000)) e.push(`${w}: wait 1~5000ms`);
      } else {
        e.push(`${w}: 알 수 없는 step type`);
      }
    }
  }
  return e;
}

// ─── 섬 ─────────────────────────────────────────────────────────

export function validateIsland(i: IslandLayout, file: string): string[] {
  const e: string[] = [];
  const at = `island[${i.id}]`;
  if (!has(ISLAND_IDS, i.id)) return [`${file}: id '${i.id}' 가 ISLAND_IDS 에 없음`];
  if (!file.endsWith(`/${i.id}.json`)) e.push(`${at}: 파일 이름은 ${i.id}.json`);
  if (!['island', 'seaCourse', 'interior'].includes(i.kind)) e.push(`${at}: kind 잘못됨`);
  if (!isStr(i.name)) e.push(`${at}: name 필요`);
  i.chapters.forEach((c) => has(CHAPTER_IDS, c) || e.push(`${at}: chapters '${c}' 잘못됨`));
  if (Math.abs(i.hubPos[0]) > 600 || Math.abs(i.hubPos[1]) > 600) e.push(`${at}: hubPos 는 ±600 이내`);
  const T = i.terrain;
  if (!(T.radius >= 20 && T.radius <= 400)) e.push(`${at}: terrain.radius 20~400`);
  if (!(T.maxHeight >= 0 && T.maxHeight <= 80)) e.push(`${at}: terrain.maxHeight 0~80`);
  if (!(T.roughness >= 0 && T.roughness <= 1)) e.push(`${at}: terrain.roughness 0~1`);
  if (i.kind === 'seaCourse' && !i.course) e.push(`${at}: seaCourse 는 course 필요`);

  const inside = (p: XZ, what: string) => {
    if (!Array.isArray(p) || p.length !== 2 || !p.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      e.push(`${at}: ${what} 좌표 형식 [x, z]`);
      return;
    }
    const [x, z] = p;
    if (i.kind === 'seaCourse' && i.course) {
      if (Math.abs(x) > i.course.width / 2 || z < 0 || z > i.course.length) e.push(`${at}: ${what} [${x}, ${z}] 가 코스 밖`);
    } else if (i.kind === 'interior') {
      if (Math.abs(x) > T.radius || Math.abs(z) > T.radius) e.push(`${at}: ${what} [${x}, ${z}] 가 실내 밖`);
    } else if (Math.hypot(x, z) > T.radius - T.beachWidth * 0.3) {
      e.push(`${at}: ${what} [${x}, ${z}] 가 섬 밖(바다)`);
    }
  };
  inside(i.spawn, 'spawn');
  const groups: [string, { id: string; pos?: XZ; center?: XZ }[]][] = [
    ['zones', i.zones], ['checkpoints', i.checkpoints], ['gates', i.gates], ['shrines', i.shrines],
    ['chests', i.chests], ['npcs', i.npcs], ['enemies', i.enemies], ['collectibles', i.collectibles],
  ];
  const allIds = new Set<string>();
  for (const [name, list] of groups) {
    for (const it of list) {
      if (allIds.has(it.id)) e.push(`${at}: id '${it.id}' 중복 (섬 안에서 유일해야 함)`);
      allIds.add(it.id);
      inside((it.pos ?? it.center) as XZ, `${name}[${it.id}]`);
    }
  }
  i.gates.forEach((g) => i.chapters.includes(g.chapter) || e.push(`${at}: gate '${g.id}' 의 chapter 가 이 섬 장이 아님`));
  i.npcs.forEach((n) => has(MODEL_IDS, n.model) || e.push(`${at}: npc '${n.id}' model '${n.model}' 잘못됨`));
  i.enemies.forEach((n) => {
    if (!has(MODEL_IDS, n.model)) e.push(`${at}: enemy '${n.id}' model '${n.model}' 잘못됨`);
    if (!(isInt(n.count) && n.count >= 1)) e.push(`${at}: enemy '${n.id}' count 필요`);
  });
  i.chests.forEach((c) => (isInt(c.coins) && c.coins > 0) || e.push(`${at}: chest '${c.id}' coins 필요`));
  i.props.forEach((p, k) => {
    if (!has(PROP_IDS, p.model)) e.push(`${at}: props[${k}] model '${p.model}' 는 PROP_IDS 에 없음`);
    inside(p.pos, `props[${k}]`);
  });
  if (i.boss) {
    if (!has(BOSS_IDS, i.boss.id)) e.push(`${at}: boss '${i.boss.id}' 잘못됨`);
    inside(i.boss.arenaCenter, 'boss.arenaCenter');
  }
  return e;
}
