/**
 * 오디세이 — 모듈 간 계약 (Contract)
 *
 * 이 파일은 Claude(엔진)와 Codex(일괄 작업)가 동시에 작업하기 위한 '약속'입니다.
 * - Codex: 이 파일을 수정하지 마세요. 바꿔야 할 점은 PR 설명에 제안으로 적어 주세요.
 * - 단위: 1 = 1미터. 좌표계는 Three.js 기본(+Y 위). 캐릭터 정면은 +Z.
 * - 모든 사용자 노출 텍스트는 한국어, 초등 1~3학년 눈높이.
 */
import type { Group } from 'three';

// ════════════════════════════════════════════════════════════════
// 1. 공통
// ════════════════════════════════════════════════════════════════

export type Grade = 1 | 2 | 3;
export const GRADES = [1, 2, 3] as const satisfies readonly Grade[];

export const SUBJECTS = ['english', 'hanja', 'math', 'clock', 'manners'] as const;
export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_LABEL: Record<Subject, string> = {
  english: '영어단어',
  hanja: '한자',
  math: '수학',
  clock: '시계',
  manners: '예절',
};

export const CHAPTER_IDS = [
  'ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07', 'ch08', 'ch09',
  'ch10', 'ch11', 'ch12', 'ch13', 'ch14', 'ch15', 'ch16', 'ch17',
] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

/** 지면 위 좌표 [x, z] (미터). y 는 지형 높이에서 자동 계산 */
export type XZ = [number, number];

// ════════════════════════════════════════════════════════════════
// 2. 학습 콘텐츠 데이터  (data/learning/*.json — Codex A1)
// ════════════════════════════════════════════════════════════════

export const ENGLISH_TOPICS = [
  'animals', 'colors', 'numbers', 'family', 'body',
  'food', 'nature', 'sea', 'house', 'actions',
] as const;
export type EnglishTopic = (typeof ENGLISH_TOPICS)[number];

/** data/learning/english.json 의 한 항목 */
export interface EnglishWord {
  /** 'en-' + 단어 (공백은 '-'), 예: 'en-sea', 'en-ice-cream' */
  id: string;
  /** 소문자 영어 단어, 예: 'sea' */
  word: string;
  /** 대표 뜻, 예: '바다' */
  meaningKo: string;
  grade: Grade;
  topic: EnglishTopic;
  /** 그림 대신 보여 줄 이모지 1개, 예: '🌊' */
  emoji: string;
  /** (선택) 3학년용 아주 쉬운 예문, 6단어 이내. 예: 'I see the sea.' */
  sentence?: string;
  /** (선택) 예문 뜻 */
  sentenceKo?: string;
  /** (선택) 이 단어가 특히 어울리는 장 */
  chapterHint?: ChapterId[];
}

export const HANJA_LEVELS = ['8급', '7급II', '7급'] as const;
export type HanjaLevel = (typeof HANJA_LEVELS)[number];

export interface HanjaExampleWord {
  /** 한자어, 예: '家族' */
  hanja: string;
  /** 읽기, 예: '가족' */
  reading: string;
  /** 쉬운 뜻풀이, 예: '한집에 사는 사람들' */
  meaning: string;
}

/** data/learning/hanja.json 의 한 항목 (한국어문회 급수 기준) */
export interface Hanja {
  /** 'hj-' + 글자, 예: 'hj-家' */
  id: string;
  /** 한자 한 글자 */
  char: string;
  /** 훈(뜻), 예: '집' */
  hun: string;
  /** 음, 예: '가' */
  eum: string;
  level: HanjaLevel;
  /** 권장 학년 */
  grade: Grade;
  strokes: number;
  /** 1~3개 */
  exampleWords: HanjaExampleWord[];
  chapterHint?: ChapterId[];
}

export const MANNERS_CATEGORIES = [
  'greeting', // 인사
  'thanks', // 감사
  'sorry', // 사과
  'turn', // 차례 지키기
  'table', // 식사 예절
  'public', // 공공장소
  'honorific', // 존댓말
  'guest', // 손님 예절
  'honesty', // 정직·약속
] as const;
export type MannersCategory = (typeof MANNERS_CATEGORIES)[number];

/** data/learning/manners.json 의 한 항목 */
export interface MannersScene {
  /** 'mn-' + 숫자 3자리, 예: 'mn-001' */
  id: string;
  grade: Grade;
  category: MannersCategory;
  /** 상황 설명 한두 문장 (50자 이내). 게임 속 인물이 나와도 좋음 */
  situation: string;
  /** 장면 아이콘 이모지 */
  emoji: string;
  /** 보기 3개 (각 30자 이내) */
  choices: [string, string, string];
  answerIndex: 0 | 1 | 2;
  /** 정답 후 칭찬 (아테의 말) */
  praise: string;
  /** 오답 시 힌트 (정답을 직접 말하지 않음) */
  hint: string;
  chapterHint?: ChapterId[];
}

// ════════════════════════════════════════════════════════════════
// 3. 문제(Question) — 퀴즈 UI 가 그리는 단위
// ════════════════════════════════════════════════════════════════

/** 아날로그 시각. h: 1~12, m: 0~59 */
export interface ClockTime {
  h: number;
  m: number;
}

interface QuestionBase {
  /**
   * 복습 상자 키 — 같은 문제는 항상 같은 id.
   * 예: 'math:add:7+5', 'clock:read:3:30', 'clock:set:9:05', 'en-sea:meaning'
   */
  id: string;
  subject: Subject;
  grade: Grade;
  /** 화면에 크게 보일 질문 (한국어, 40자 이내) */
  prompt: string;
  /** 질문 옆에 크게 보여 줄 이모지 */
  emoji?: string;
  /** 질문 영역에 아날로그 시계를 그릴 때 그 시각 */
  clock?: ClockTime;
  /** 오답 시 아테가 주는 힌트 (정답을 직접 말하지 않음) */
  hint?: string;
  /** 정답 공개 후 짧은 설명 */
  explain?: string;
}

/** 보기 고르기 (2~4개) */
export interface ChoiceQuestion extends QuestionBase {
  kind: 'choice';
  choices: string[];
  answerIndex: number;
}

/** 숫자 패드로 답 입력 */
export interface NumberQuestion extends QuestionBase {
  kind: 'number';
  answer: number;
}

/** 시곗바늘을 끌어서 맞추기 */
export interface ClockSetQuestion extends QuestionBase {
  kind: 'clockSet';
  answer: ClockTime;
  /** 분침이 착 붙는 간격: 1학년 30, 2학년 5, 3학년 1 */
  snapMinutes: 1 | 5 | 30;
}

/** 글자 타일로 철자 맞추기 */
export interface SpellQuestion extends QuestionBase {
  kind: 'spell';
  answer: string;
  /** 정답 글자 + 헷갈리는 글자, 섞인 순서 */
  tiles: string[];
}

/** 순서 맞추기 (12장 이야기 되짚기 등) */
export interface OrderQuestion extends QuestionBase {
  kind: 'order';
  items: string[];
  /** items 의 올바른 순서(인덱스 배열) */
  answerOrder: number[];
}

export type Question =
  | ChoiceQuestion
  | NumberQuestion
  | ClockSetQuestion
  | SpellQuestion
  | OrderQuestion;
export type QuestionKind = Question['kind'];

// ════════════════════════════════════════════════════════════════
// 4. 문제 생성기  (src/learning/generators/ — Codex A2)
// ════════════════════════════════════════════════════════════════

export type MathOp = 'add' | 'sub' | 'mul' | 'div';

/**
 * 문장형 수학 템플릿. {a}, {b} 자리에 생성된 수가 들어감.
 * - add: a + b        예: '양 {a}마리와 {b}마리가 모였어요. 모두 몇 마리?'
 * - sub: a - b (a≥b)  예: '양 {a}마리 중 {b}마리가 나갔어요. 남은 양은?'
 * - mul: a × b        예: '배 {a}척에 {b}명씩 타면 모두 몇 명?'
 * - div: a ÷ b (나머지 0) 예: '병사 {a}명을 초소 {b}곳에 똑같이 나누면 한 곳에 몇 명?'
 */
export interface MathTemplate {
  op: MathOp;
  text: string;
  emoji?: string;
}

export interface MathGenOptions {
  grade: Grade;
  /** 같은 seed → 같은 문제 (결정적) */
  seed: number;
  /** 허용 연산 (없으면 학년 기본) */
  ops?: MathOp[];
  /** 문장형으로 낼 때 */
  template?: MathTemplate;
  /** 기본 'choice' */
  format?: 'choice' | 'number';
}
/** src/learning/generators/math.ts 의 `generateMath` */
export type MathGenerator = (opts: MathGenOptions) => ChoiceQuestion | NumberQuestion;

export type ClockQuestionType = 'read' | 'set' | 'elapsed';
export interface ClockGenOptions {
  grade: Grade;
  seed: number;
  /** 없으면 학년에 맞게 섞어서 */
  type?: ClockQuestionType;
}
/** src/learning/generators/clock.ts 의 `generateClock` */
export type ClockGenerator = (opts: ClockGenOptions) => ChoiceQuestion | ClockSetQuestion;

/** 12시 방향 0°, 시계 방향으로 증가 (0 이상 360 미만) */
export interface HandAngles {
  hourDeg: number;
  minuteDeg: number;
}
/** src/learning/generators/clock.ts 의 `clockHandAngles` — 시침은 분에 따라 비례 이동 */
export type ClockHandAngles = (t: ClockTime) => HandAngles;

// ════════════════════════════════════════════════════════════════
// 5. 학습 엔진 API  (src/learning/ — Claude)
// ════════════════════════════════════════════════════════════════

export type QuizPlacement = 'gate' | 'boss' | 'npc' | 'shrine' | 'story';

/** 챕터 데이터 안의 퀴즈 자리 */
export interface QuizSlot {
  /** 챕터 안에서 유일, 예: 'gate-1', 'boss-weak' */
  id: string;
  subject: Subject;
  placement: QuizPlacement;
  /** 연속 출제 수 (보스 약점은 1, 지혜의 문은 2~3) */
  count: number;
  /** 문제 형식 지정 (없으면 엔진이 고름) */
  kind?: QuestionKind;
  /** english/hanja/manners: 특정 항목 고정 출제 (id 목록) */
  ids?: string[];
  /** english: EnglishTopic / manners: MannersCategory 로 범위 좁히기 */
  topic?: string;
  /** math: 문장형 템플릿 */
  mathTemplate?: MathTemplate;
  /** clock: 문제 유형 */
  clockType?: ClockQuestionType;
}

export interface AskRequest {
  reason: QuizPlacement;
  /** 챕터 퀴즈 자리를 그대로 넘기거나 */
  slot?: QuizSlot;
  /** 즉석 출제 과목 (slot 이 없을 때) */
  subject?: Subject;
}
export interface AskResult {
  /** 모든 문제를 결국 맞혔는가 (오답 후 재도전 포함) */
  correct: boolean;
  /** 첫 시도에 맞힌 문제 수 */
  firstTry: number;
  questionIds: string[];
}
export interface LearningApi {
  ask(req: AskRequest): Promise<AskResult>;
}

// ════════════════════════════════════════════════════════════════
// 6. 사운드  (src/audio/ — Codex A3). 음성(목소리)은 만들지 않음
// ════════════════════════════════════════════════════════════════

export const SFX_IDS = [
  // 이동
  'step_sand', 'step_grass', 'step_stone', 'step_wood', 'jump', 'land', 'roll', 'swim',
  // 전투
  'sword_swing', 'sword_hit', 'shield_block', 'bow_draw', 'bow_release', 'arrow_hit',
  'player_hurt', 'enemy_hurt', 'enemy_defeat', 'boss_roar', 'boss_hit', 'boss_defeat',
  // 월드
  'coin', 'pickup', 'heal', 'chest_open', 'door_open', 'gate_unlock', 'checkpoint',
  'splash', 'wave', 'thunder', 'wind', 'whirlpool', 'magic', 'sheep', 'pig', 'owl', 'sail', 'rope',
  // 학습·UI
  'correct', 'wrong', 'hint', 'combo', 'ui_click', 'ui_open', 'ui_close', 'level_up', 'victory',
] as const;
export type SfxId = (typeof SFX_IDS)[number];

export const BGM_IDS = [
  'title', // 타이틀
  'sailing', // 바다 항해 (허브)
  'memorySea', // 회상의 바다 (3~11장 허브)
  'island', // 섬 탐험
  'cave', // 동굴 (3장)
  'shadow', // 그림자 나라 (8장)
  'boss', // 일반 보스
  'siren', // 세이렌 멜로디 (11장)
  'ithaca', // 고향 이타카
  'palace', // 궁전 (12·16장)
  'finalBoss', // 최종 보스 (16장)
  'ending', // 엔딩·잔치
] as const;
export type BgmId = (typeof BGM_IDS)[number];

export type Instrument = 'lyre' | 'flute' | 'bass' | 'pad' | 'drum';
export type DrumHit = 'kick' | 'snare' | 'hat' | 'tom';
export type ScaleMode = 'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian';

export interface NoteEvent {
  /** 패턴 시작부터의 스텝 위치 (0부터) */
  step: number;
  /** 음 이름 'D4', 'F#3', 'Bb2' / instrument 가 'drum' 이면 DrumHit */
  note: string;
  /** 길이 (스텝 단위, 1 이상) */
  len: number;
  /** 세기 0~1 (기본 0.8) */
  vel?: number;
}
export interface BgmLayer {
  instrument: Instrument;
  notes: NoteEvent[];
  /** 레이어 볼륨 0~1 (기본 0.7) */
  gain?: number;
}
export interface BgmPattern {
  id: string;
  /** 한 마디의 스텝 수 (보통 16 = 16분음표) */
  stepsPerBar: number;
  bars: number;
  layers: BgmLayer[];
}
export interface BgmTrack {
  id: BgmId;
  /** 곡 제목 (한국어) */
  title: string;
  bpm: number;
  /** 으뜸음 'D', 'A', 'F#' … */
  root: string;
  mode: ScaleMode;
  patterns: BgmPattern[];
  /** 재생 순서 (pattern id 목록) */
  sequence: string[];
  /** 끝까지 재생한 뒤 되돌아갈 sequence 인덱스 */
  loopFrom: number;
}

/** src/audio/index.ts 의 `createAudio()` 가 돌려주는 객체 */
export interface AudioApi {
  /** 첫 사용자 입력(클릭·터치·키) 때 엔진이 호출. 그 전에는 AudioContext 를 만들지 않는다 */
  unlock(): void;
  readonly unlocked: boolean;
  sfx(id: SfxId, opts?: { volume?: number; pitch?: number }): void;
  /** 같은 곡이 이미 재생 중이면 아무것도 하지 않음. 다른 곡이면 크로스페이드 */
  playBgm(id: BgmId, opts?: { fadeMs?: number }): void;
  stopBgm(fadeMs?: number): void;
  /** 0~1 */
  setVolume(channel: 'master' | 'sfx' | 'bgm', value: number): void;
}

// ════════════════════════════════════════════════════════════════
// 7. 블록 모델  (src/models/ — Codex A4)
// ════════════════════════════════════════════════════════════════

/** 사람형 — HUMANOID_PARTS 리그 필수 */
export const HUMANOID_IDS = [
  // 주인공·동료
  'odysseus', 'crewman', 'telemachus',
  // 신·NPC
  'athena', 'hermes', 'calypso', 'ino', 'aeolus', 'circe', 'tiresias',
  'nausicaa', 'alcinous', 'penelope', 'eumaeus', 'poseidon', 'helios',
  // 적·보스
  'polyphemus', 'lotusEater', 'lotusKing', 'laestrygonian', 'laestrygonianKing',
  'siren', 'sirenQueen', 'greekSoldier', 'soldierCaptain', 'suitor', 'antinous',
] as const;
export type HumanoidId = (typeof HUMANOID_IDS)[number];

/** 동물·괴물 — 부위 이름은 CREATURE_PART_HINTS 참고 */
export const CREATURE_IDS = [
  'athenaOwl', 'sheep', 'cow', 'goldenCow', 'pig', 'dog', 'seagull', 'dolphin', 'scylla',
] as const;
export type CreatureId = (typeof CREATURE_IDS)[number];

/** 소품·건물·장비·효과 */
export const PROP_IDS = [
  // 배
  'raft', 'ship', 'phaeacianShip', 'rowboat',
  // 식물
  'palmTree', 'oliveTree', 'pineTree', 'bush', 'flowerPatch', 'grassTuft', 'lotus', 'molyFlower',
  // 지형 소품
  'rock', 'boulder', 'cliff', 'caveEntrance', 'whirlpool',
  // 건물
  'column', 'brokenColumn', 'temple', 'hut', 'house', 'palace', 'dock', 'bridge', 'fence', 'stairs',
  // 게임 오브젝트
  'chest', 'coin', 'owlShrine', 'wisdomGate', 'checkpointFlag', 'signpost', 'log',
  // 생활 소품
  'campfire', 'torch', 'amphora', 'barrel', 'crate', 'net', 'cage', 'windBag',
  'loom', 'oliveBed', 'axeRow', 'ball', 'sundial', 'clockTower',
  // 장비 (handR/handL 에 붙임)
  'sword', 'shield', 'bow', 'arrow', 'trident', 'caduceus', 'wand',
] as const;
export type PropId = (typeof PROP_IDS)[number];

export type ModelId = HumanoidId | CreatureId | PropId;

/**
 * 사람형 리그 규약
 * - 루트 Group 원점 = 발바닥 중앙, 정면 +Z
 * - 아래 이름의 Object3D 가 group.getObjectByName(name) 으로 찾아져야 함 (계층은 자유)
 * - 각 부위의 원점(pivot) = 관절 위치 (head: 목, armL/armR: 어깨, legL/legR: 엉덩이, torso: 허리)
 *   → 엔진이 rotation.x 만 돌려서 걷기·휘두르기 애니메이션을 만든다
 * - L/R 은 캐릭터 기준 (armL 은 캐릭터의 왼팔 = +X 쪽)
 * - 보통 어른 키 2.0 (다리 0.8, 몸통 0.8, 머리 0.4) — 로블록스식 큰 머리 비율
 */
export const HUMANOID_PARTS = ['torso', 'head', 'armL', 'armR', 'legL', 'legR'] as const;
export type HumanoidPart = (typeof HUMANOID_PARTS)[number];

/** 장비 부착점 (빈 Object3D): handR 무기, handL 방패, headTop 투구·관, back 망토 */
export const ATTACH_POINTS = ['handR', 'handL', 'headTop', 'back'] as const;
export type AttachPoint = (typeof ATTACH_POINTS)[number];

/** 동물·괴물 부위 이름 권장 (엔진 애니메이션이 찾는 이름) */
export const CREATURE_PART_HINTS: Record<CreatureId, readonly string[]> = {
  athenaOwl: ['body', 'head', 'wingL', 'wingR'],
  sheep: ['body', 'head', 'leg0', 'leg1', 'leg2', 'leg3'],
  cow: ['body', 'head', 'leg0', 'leg1', 'leg2', 'leg3'],
  goldenCow: ['body', 'head', 'leg0', 'leg1', 'leg2', 'leg3'],
  pig: ['body', 'head', 'leg0', 'leg1', 'leg2', 'leg3'],
  dog: ['body', 'head', 'tail', 'leg0', 'leg1', 'leg2', 'leg3'],
  seagull: ['body', 'wingL', 'wingR'],
  dolphin: ['body', 'tail'],
  scylla: ['body', 'neck0', 'neck1', 'neck2', 'neck3', 'neck4', 'neck5', 'head0', 'head1', 'head2', 'head3', 'head4', 'head5'],
};

/** 모델 크기 기준 (userData.height, 미터) — 테스트가 이 범위를 검사 */
export const MODEL_HEIGHT_RANGE: Partial<Record<ModelId, [number, number]>> = {
  odysseus: [1.8, 2.3],
  crewman: [1.7, 2.2],
  telemachus: [1.7, 2.2],
  polyphemus: [5, 7.5],
  laestrygonian: [3.5, 5],
  laestrygonianKing: [5, 7.5],
  poseidon: [6, 10],
  helios: [6, 10],
  scylla: [5, 9],
  sheep: [0.7, 1.3],
  athenaOwl: [0.4, 0.9],
};

export const HELMET_IDS = ['none', 'bronze', 'crested', 'laurel', 'owl'] as const;
export type HelmetId = (typeof HELMET_IDS)[number];

/** 오디세우스 꾸미기 (올리브잎 코인으로 해금) */
export interface AvatarCustomization {
  helmet: HelmetId;
  /** '#rrggbb' */
  tunicColor: string;
  /** null 이면 망토 없음 */
  capeColor: string | null;
  shieldColor: string;
}
export const DEFAULT_AVATAR: AvatarCustomization = {
  helmet: 'bronze',
  tunicColor: '#3b6fd8',
  capeColor: '#c0392b',
  shieldColor: '#d4a017',
};

export interface ModelOptions {
  /** 색 변형 번호 (crewman·suitor·greekSoldier·lotusEater 0~3) */
  variant?: number;
  /** odysseus 전용 */
  avatar?: AvatarCustomization;
}

/**
 * 모델 빌더 — 순수 함수, 호출할 때마다 새 Group.
 * 반드시 group.userData = { height: number, radius: number } 설정 (충돌 원기둥).
 * 재질은 src/models/palette.ts 의 공용 MeshToonMaterial 재사용 (드로콜·메모리 절약).
 */
export type ModelBuilder = (opts?: ModelOptions) => Group;
export type ModelRegistry = Record<ModelId, ModelBuilder>;

// ════════════════════════════════════════════════════════════════
// 8. 섬 레이아웃  (data/islands/*.json — Codex B2)
// ════════════════════════════════════════════════════════════════

export const ISLAND_IDS = [
  'ogygia', // 1장 칼립소의 섬
  'stormSea', // 2장 폭풍 바다 (러너 코스)
  'cyclops', // 3장 외눈 거인 섬
  'lotus', // 4장 연꽃 섬
  'aeolia', // 5장 바람의 섬
  'laestrygonia', // 6장 거인의 항구
  'aeaea', // 7장 키르케의 섬
  'underworld', // 8장 그림자 나라
  'thrinacia', // 9장 헬리오스의 섬
  'strait', // 10장 스킬라·카리브디스 해협 (항해 코스)
  'sirens', // 11장 세이렌 바위섬
  'scheria', // 12장 파이아케스 섬
  'ithaca', // 13~15장 이타카
  'ithacaPalace', // 16~17장 궁전 내부
] as const;
export type IslandId = (typeof ISLAND_IDS)[number];

export type TerrainPalette =
  | 'tropical' | 'grass' | 'rock' | 'volcanic' | 'flower' | 'shadow' | 'golden' | 'marble';

export interface IslandLayout {
  id: IslandId;
  /** 표시 이름, 예: '오기기아 섬' */
  name: string;
  /** island: 섬 / seaCourse: z 축으로 뻗은 바다 코스 / interior: 실내 */
  kind: 'island' | 'seaCourse' | 'interior';
  chapters: ChapterId[];
  /** 에게해 허브 맵(가로세로 1200m, 중심 0,0)에서의 위치 */
  hubPos: XZ;
  terrain: {
    /** island: 섬 반지름 / interior: 바닥 반너비 */
    radius: number;
    maxHeight: number;
    seed: number;
    /** 0(평평)~1(울퉁불퉁) */
    roughness: number;
    beachWidth: number;
    palette: TerrainPalette;
  };
  /** seaCourse 전용: 코스 길이(z: 0→length), 폭 */
  course?: { length: number; width: number };
  spawn: XZ;
  zones: { id: string; name: string; center: XZ; radius: number }[];
  checkpoints: { id: string; pos: XZ }[];
  /** 지혜의 문 — quizSlot 은 해당 장 ChapterData.quizSlots 의 id */
  gates: { id: string; pos: XZ; rotY: number; chapter: ChapterId; quizSlot: string }[];
  shrines: { id: string; pos: XZ }[];
  chests: { id: string; pos: XZ; coins: number }[];
  npcs: { id: string; model: ModelId; pos: XZ; rotY?: number }[];
  enemies: { id: string; model: ModelId; pos: XZ; count: number; spread: number }[];
  /** 목표 아이템 (통나무, 욜리꽃, 과일 …) — item 은 Objective.target 과 같은 이름 */
  collectibles: { id: string; item: string; pos: XZ }[];
  props: { model: PropId; pos: XZ; rotY?: number; scale?: number }[];
  boss?: { id: BossId; arenaCenter: XZ; arenaRadius: number };
}

// ════════════════════════════════════════════════════════════════
// 9. 챕터 데이터  (data/chapters/chNN.json — Codex B1)
// ════════════════════════════════════════════════════════════════

export const BOSS_IDS = [
  'polyphemus', // 3장
  'lotusKing', // 4장
  'laestrygonianKing', // 6장
  'circe', // 7장
  'helios', // 9장 (벼락 피하기)
  'scylla', // 10장
  'sirenQueen', // 11장
  'soldierCaptain', // 14장
  'antinous', // 16장 최종
] as const;
export type BossId = (typeof BOSS_IDS)[number];

export type SpeakerId = 'narrator' | HumanoidId | 'athenaOwl' | 'dog';
export type Emote = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'scared';

export type SceneStep =
  /** 대사 한 줄 (25자 권장, 30자 이내) */
  | { type: 'line'; speaker: SpeakerId; text: string; emote?: Emote }
  /** 화면 가운데 큰 자막 (예: '오디세우스는 지난 모험을 떠올렸어요') */
  | { type: 'caption'; text: string }
  /** 이 장의 quizSlots 중 하나 출제 */
  | { type: 'quiz'; slot: string }
  | { type: 'sfx'; id: SfxId }
  | { type: 'wait'; ms: number };

export type SceneTrigger =
  | { on: 'chapterStart' }
  | { on: 'chapterEnd' }
  | { on: 'objectiveDone'; objective: string }
  | { on: 'talk'; npc: string }
  | { on: 'enterZone'; zone: string }
  | { on: 'bossPhase'; phase: string };

export interface Scene {
  /** 챕터 안에서 유일 */
  id: string;
  trigger: SceneTrigger;
  steps: SceneStep[];
}

export type ObjectiveType =
  | 'reach' // 장소 도착 (target = zone id)
  | 'collect' // 아이템 모으기 (target = item, count)
  | 'defeat' // 적 무찌르기 (target = enemy group id, count)
  | 'rescue' // 부하 구출 (target = item/npc 그룹, count)
  | 'talk' // 대화 (target = npc id)
  | 'quiz' // 퀴즈 자리 통과 (target = quizSlot id)
  | 'survive' // 버티기 (timeLimitSec)
  | 'boss' // 보스전 (target = BossId)
  | 'minigame'; // 미니게임 (target = minigame id)

export interface Objective {
  /** 챕터 안에서 유일 */
  id: string;
  type: ObjectiveType;
  /** HUD 에 보일 짧은 목표 (20자 이내) */
  text: string;
  target?: string;
  count?: number;
  timeLimitSec?: number;
}

export type PlayStyle =
  | 'explore' | 'combat' | 'runner' | 'sailing' | 'dialogue'
  | 'defense' | 'stealth' | 'survival' | 'boss' | 'minigame';

/**
 * 미니게임 id — Objective(type 'minigame').target 에 쓴다.
 * 섬에 같은 id 의 zone 이 있으면 그 자리에서 시작(상호작용), 없으면 목표가 켜지는 즉시 시작.
 * 아직 구현되지 않은 미니게임은 '준비 중' 안내 후 자동 통과된다.
 */
export const MINIGAME_IDS = [
  'raftBuild', // 1장 뗏목 만들기
  'waveRunner', // 2장 폭풍 파도 러너
  'sheepEscape', // 3장 양 밑에 숨어 동굴 탈출
  'windSail', // 5장 바람 타고 항해
  'nightWatch', // 5장 불침번 교대 (시계)
  'lightningDodge', // 9장 헬리오스 벼락 피하기
  'whirlpoolSteer', // 10장 소용돌이 피해 배 조종
  'rhythmShield', // 11장 세이렌 음표 막기
  'ballGame', // 12장 나우시카 공놀이
  'hideWeapons', // 15장 무기 숨기기 퍼즐
  'bowString', // 16장 활시위 걸기
  'axeArchery', // 16장 도끼 12개 꿰뚫기
  'feast', // 17장 잔치 (식사 예절)
] as const;
export type MinigameId = (typeof MINIGAME_IDS)[number];

export interface ChapterData {
  id: ChapterId;
  /** 1~17 */
  no: number;
  /** 장 제목, 예: '칼립소의 섬' */
  title: string;
  titleCard: {
    /** 아이 원문 — CHILD_STORY[id] 와 글자 하나까지 같아야 함 (테스트가 검사) */
    childText: string;
    /** 한 줄 부제 (20자 이내) */
    subtitle: string;
  };
  /** 회상 구간(3~11장)이면 true */
  memory: boolean;
  island: IslandId;
  playStyles: PlayStyle[];
  bgm: { explore: BgmId; boss?: BgmId };
  /** 이 장의 주요 학습 과목 */
  learning: Subject[];
  scenes: Scene[];
  /** 진행 순서대로 */
  objectives: Objective[];
  quizSlots: QuizSlot[];
  boss?: BossId;
  reward: { coins: number; unlocks?: string[] };
}
