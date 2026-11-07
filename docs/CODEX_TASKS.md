# Codex 작업 지시서 (붙여넣기용)

P0(뼈대·계약·테스트)가 main 에 올라가 있으면 바로 시작할 수 있습니다.
각 작업은 **서로 다른 폴더만** 건드리므로 동시에 여러 개를 돌려도 충돌하지 않습니다.

| 작업 | 시작 시점 | 수정 폴더 | 추천 모델 | 완료 판정 |
|---|---|---|---|---|
| A1 학습 데이터 | **지금** | `data/learning/` | Medium → 마지막에 High 검수 1회 | `npm run test:accept -- tests/learning` |
| A2 문제 생성기 | **지금** | `src/learning/generators/` | Astra High | `npm run test:accept -- tests/generators` |
| A3 효과음·배경음 | **지금** | `src/audio/` | Astra High | `npm run test:accept -- tests/audio` + 개발 페이지에서 귀로 확인 |
| A4 블록 모델 | **지금** | `src/models/` | Astra High | `npm run test:accept -- tests/models` + 갤러리에서 눈으로 확인 |
| B1 챕터 데이터 | **지금** | `data/chapters/` | Medium | `npm run test:accept -- tests/chapters` |
| B2 섬 레이아웃 | P1 이후 (지형 생성기 확정 뒤) | `data/islands/` | Medium | `npm run test:accept -- tests/islands` |
| 보스 패턴 | P2 (폴리페모스 템플릿 이후) | `src/enemies/bosses/<이름>.ts` | Astra High | P2 때 안내 |

> B1 은 지금 시작해도 됩니다. P1 에서 챕터 형식이 조금 바뀌면 Claude 가 JSON 을 일괄 변환합니다.

---

## Codex 실행 방법

- **권장: Codex 클라우드** — 저장소 `hjpapa/odyseey` 연결 → 작업마다 새 태스크 → 결과를 PR 로 받기.
  환경 설정: Node 24, 설치 스크립트 `npm ci`.
- **로컬 Codex CLI 를 쓸 때**: Claude 가 같은 폴더에서 작업 중이므로 반드시 별도 작업 폴더(worktree)에서 실행하세요.
  ```bash
  git worktree add ../odyseey-a1 -b codex/learning-data
  ```
  그 폴더에서 `npm ci` 후 Codex 실행 → 끝나면 push 하고 PR.
- PR 이 올라가면 GitHub Actions(CI)가 타입 검사·테스트·빌드를 돌리고, Vercel 이 프리뷰 URL 을 댓글로 달아 줍니다.

## 공통 규칙 (모든 지시문 맨 앞에 붙이기)

```
저장소: https://github.com/hjpapa/odyseey  (Vite + TypeScript + Three.js, Node 24)
먼저 읽을 것: docs/PLAN.md, docs/STORY.md, src/types/contracts.ts, 그리고 이 작업의 수용 테스트 파일.

규칙:
- src/types/contracts.ts, tests/ 아래 기존 파일, package.json 은 수정 금지.
  계약을 바꿔야 할 것 같으면 PR 설명에 '계약 변경 제안'으로만 적어.
- 지정한 폴더 밖의 파일은 수정하지 마. (테스트를 더 쓰고 싶으면 tests/<작업폴더>/ 에 새 파일로 추가)
- 브랜치 codex/<작업명> 에서 작업하고 PR 올려.
- 끝내기 전에 반드시 통과: npm run typecheck && npm test && npm run build
  그리고 이 작업의 수용 테스트: npm run test:accept -- <지정 폴더>
- 대상은 초등 1~3학년. 무섭거나 잔인한 표현 금지 (적은 '별가루로 사라진다', 잡아먹기 → 붙잡혀 감).
- 사용자에게 보이는 글은 한국어, 쉬운 말.
```

---

## A1. 학습 콘텐츠 데이터 — 통째로 맡김 / 추천: Medium (마지막 검수만 Astra High)

```
작업명: learning-data
수정 폴더: data/learning/ (english.json, hanja.json, manners.json)
수용 테스트: tests/learning/learning.accept.test.ts
형식: src/types/contracts.ts 의 EnglishWord, Hanja, MannersScene. 지금 들어 있는 예시 항목은 유지하고 늘려.

1) english.json — 300개 이상
   - 주제(ENGLISH_TOPICS) 10개 각각 15개 이상, 학년별 25% 이상
   - 스토리 단어 필수: sea, wave, boat, wind, sheep, eye, pig, lion, wolf, sun, cow, bow, home,
     king, queen, island, flower, cave, ship, star (어울리는 장을 chapterHint 로)
   - 1학년: 3~4글자 그림 단어 / 2학년: 생활 단어 / 3학년: 조금 긴 단어 + 6단어 이내 예문(sentence, sentenceKo 필수)
   - emoji 는 단어를 바로 떠올릴 수 있는 것 1개
2) hanja.json — 한국어문회 8급 50자 전부(level '8급') + 7급II·7급 30자 이상
   - 스토리 한자 필수: 家父母兄弟(4장) 人大小日月(8장) 山水木土門(13장) → chapterHint 표기
   - hun 은 급수 시험 표준 훈(예: 山 = 메 산), exampleWords 는 아이가 아는 낱말 위주
3) manners.json — 60개 이상
   - 분류(MANNERS_CATEGORIES) 9개 각각 4개 이상, 학년별 25% 이상
   - 정답 위치(answerIndex) 0·1·2 가 각각 20% 이상 (한쪽에 몰리지 않게)
   - STORY.md 에서 예절을 배우는 장(1·5·8·11·12·15·17장)마다 그 장 장면으로 1개 이상 (chapterHint)
   - 오답 보기도 아이가 실제로 할 법한 행동으로, 정답이 너무 뻔하지 않게
   - hint 는 정답을 직접 말하지 않고 생각할 거리를 줌
```

## A2. 수학·시계 문제 생성기 — 통째로 맡김 / 추천: Astra High

```
작업명: generators
수정 폴더: src/learning/generators/ (math.ts, clock.ts 의 임시 구현을 교체. export 이름은 유지)
수용 테스트: tests/generators/generators.accept.test.ts (+ 항상 통과해야 하는 tests/generators/generators.test.ts)
계약: MathGenerator, ClockGenerator, ClockHandAngles. 난수는 src/core/rng.ts 의 createRng(seed) 만 사용 (결정적).

수학 (generateMath)
- id 형식: 'math:<add|sub|mul|div>:<a><+|-|x|/><b>'  예: 'math:mul:3x4'
- 1학년: 합·차 20 이내 덧셈·뺄셈, 음수 없음
- 2학년: 두 자리 덧셈·뺄셈(받아올림·받아내림 포함), 곱셈구구 2·3·4·5단
- 3학년: 세 자리 덧셈·뺄셈, 곱셈구구 2~9단, 나머지 없는 나눗셈
- 보기 4개: 정답 + '그럴듯한 실수'(받아올림 빠뜨림, ±1, ±10, 자리 바꿈) — 정답과 10 이내 차이 오답 2개 이상
- template 이 오면 {a},{b} 를 채운 문장형 prompt, template.emoji 를 q.emoji 로
- 학년에 없는 연산 템플릿(예: 1학년 곱셈)은 쉬운 수로 (답 20 이내 묶어 세기)
- hint: 정답을 말하지 않는 도움말 (예: '10을 먼저 만들어 볼까요?')

시계 (generateClock, clockHandAngles 는 완성본이니 유지)
- id 형식: 'clock:<read|set|elapsed>:<h>:<mm>' (elapsed 는 뒤에 '+<분>' 을 붙여도 됨)
- 1학년 정각·30분 / 2학년 5분 단위 / 3학년 1분 단위
- read: 시계 그림(clock) + 4지선다 '3시 30분'
- set: clockSet, snapMinutes = 1학년 30, 2학년 5, 3학년 1
- elapsed: '지금 2시예요. 3시간 뒤는 몇 시일까요?' 같은 4지선다 (2·3학년, 3학년은 분 단위 포함)
- type 이 없으면 학년에 맞게 섞기 (2·3학년은 read·set·elapsed 모두)
- 오답 보기는 시침·분침을 헷갈린 경우를 포함 (예: 6시 15분 ↔ 3시 30분)
```

## A3. 효과음·배경음 — 통째로 맡김 / 추천: Astra High

```
작업명: audio
수정 폴더: src/audio/
수용 테스트: tests/audio/audio.accept.test.ts (+ tests/audio/audio.test.ts)
확인 페이지: npm run dev → http://localhost:5173/dev/audio-test.html (버튼으로 전부 들어 보기)
계약: AudioApi, SfxId(SFX_IDS 47종), BgmId(BGM_IDS 12곡), BgmTrack. 음성(목소리)은 만들지 않음.

- zzfx(1.4.0) 는 이미 설치됨: import { ZZFX } from 'zzfx'. 타입이 없으니 src/audio/zzfx.d.ts 로 선언.
- index.ts: createAudio() 실제 구현.
  * unlock() 전에는 AudioContext 를 만들지 말 것 (node 테스트에서도 import·호출이 오류 없이 돌아야 함)
  * 채널 master/sfx/bgm 볼륨(GainNode), playBgm 크로스페이드, 같은 곡 재호출은 무시
  * 탭이 숨겨지면(visibilitychange) BGM 일시정지
- sfx.ts: sfxPresets 에 SFX_IDS 전부. 정답음은 밝고 짧게, 오답음은 부드럽게(아이가 속상하지 않게).
  발걸음·물소리 같은 잦은 소리는 아주 짧고 작게.
- sequencer.ts: BgmTrack 재생기 (스텝 시퀀서, lookahead 스케줄링). 악기: lyre(플럭), flute(사인+비브라토),
  bass, pad, drum(kick/snare/hat/tom 노이즈 합성).
- tracks/*.ts 12곡 → tracks/index.ts 의 bgmTracks 에 등록.
  * 그리스풍 선법(dorian/mixolydian/phrygian 등), 한 바퀴 25~75초, 선율 85% 이상 선법 안의 음
  * title·sailing 은 밝고 모험적으로 / memorySea 몽환적 / cave·shadow 조용하고 신비롭게 /
    boss·finalBoss 긴장감(무섭지 않게) / siren 홀리는 플루트 멜로디 / ending 따뜻하게
```

## A4. 블록 모델 — 통째로 맡김 / 추천: Astra High

```
작업명: models
수정 폴더: src/models/
수용 테스트: tests/models/models.accept.test.ts (+ tests/models/models.test.ts)
확인 페이지: npm run dev → http://localhost:5173/dev/model-gallery.html
  (초록 이름 = 진짜 모델, 빨간 이름 = 임시 블록. '리그 움직이기'로 관절이 제대로 도는지 확인)
계약: ModelId(HUMANOID_IDS 27 + CREATURE_IDS 9 + PROP_IDS 55), ModelBuilder, 리그 규약(contracts.ts 7장).
참고 구현: src/core/placeholders.ts 의 blockHumanoid() — 같은 리그 규약을 따르는 가장 단순한 예.

- registry.ts 의 modelRegistry 에 ModelId 전부 등록 (파일은 humanoids.ts / creatures.ts / props.ts 등으로 나눠도 됨)
- 로블록스풍: BoxGeometry 위주, 큰 머리 비율, 단순한 얼굴(눈·입 블록), 인물마다 상징 소품
  (헤르메스 날개 모자·지팡이, 포세이돈 삼지창, 키르케 마법봉, 테이레시아스 지팡이, 페넬로페 베틀 숄 등)
- 사람형: HUMANOID_PARTS + ATTACH_POINTS 필수, 원점=발바닥, 정면 +Z, armL 은 +X 쪽, 부위 원점=관절
- 오디세우스: avatar 옵션 반영 — 투구(HELMET_IDS)는 headTop 아래, 망토는 back 아래 (none/null 이면 비움)
- crewman·suitor·greekSoldier·lotusEater: variant 0~3 색이 서로 다르게
- 크기: MODEL_HEIGHT_RANGE 지키기 (폴리페모스 5~7.5m, 스킬라 5~9m …), userData.height/radius 설정
- 재질: palette.ts 공용 MeshToonMaterial 재사용 (빛나는 효과만 MeshBasicMaterial). 사람형 메시 80개, 그 외 200개 이하
- 무섭지 않게: 거인·괴물도 둥글둥글 귀엽게, 스킬라는 머리 6개 장난감 같은 느낌
```

## B1. 챕터 대사·목표 데이터 — 통째로 맡김 / 추천: Medium

```
작업명: chapter-data
수정 폴더: data/chapters/ (ch01.json ~ ch17.json)
수용 테스트: tests/chapters/chapters.accept.test.ts (+ tests/chapters/chapters.test.ts)
형식: ChapterData (contracts.ts 9장). 원본: docs/STORY.md

- titleCard.childText = src/story/childStory.ts 의 CHILD_STORY 와 글자 하나까지 같게 (복사해서 붙이기)
- 섬·보스·학습 과목은 tests/chapters/chapters.accept.test.ts 의 EXPECT 표를 따름 (= PLAN.md 3-4)
- ch01 시작 장면에 프롤로그(아테나의 부엉이 'athenaOwl' 대사), ch02 끝에 회상 시작 caption('…떠올렸어요')
- 이름 병기: 폴리페모스(폴리페오스), 몰리(욜리꽃) — 아이 표기를 지움 없이 함께
- 대사 한 줄 25자 권장(30자 이내), caption 40자 이내, 목표 text 20자 이내
- 퀴즈 자리: 장마다 2개 이상, 보스 장은 placement 'boss' 1개 이상, 12장은 kind 'order'(이야기 순서),
  16장은 4과목 이상 종합. npc·story 자리는 장면의 quiz step 이나 quiz 목표에서 사용
- 목표 target 이름 규칙 (B2 섬 데이터와 맞춰야 함):
  reach → zone id, talk → npc id, collect/rescue → 아이템 이름(예: 'log', 'moly', 'crew'),
  defeat → 적 그룹 id, boss → BossId
- 학습 데이터 id 를 ids 로 고정할 때는 data/learning 에 실제로 있는 id 만
```

## B2. 섬 레이아웃 초안 — P1 이후 / 추천: Medium

```
작업명: island-layouts   (B1 이 main 에 들어간 뒤 시작)
수정 폴더: data/islands/ (ISLAND_IDS 14곳)
수용 테스트: tests/islands/islands.accept.test.ts (+ tests/islands/islands.test.ts)
형식: IslandLayout (contracts.ts 8장)

- 동선: 시작 → 탐험 → 목표 → 보스, 샛길 1~2개, 섬 하나 5분 내외
- 챕터 데이터와 연결: gate 의 quizSlot, boss, 목표 target(zone·npc·collectible·enemy 그룹)이 모두 존재해야 함
- 섬: 체크포인트 1·부엉이 신전 1·보물상자 2 이상 / 바다 코스: 체크포인트 2 이상
- 허브 맵에서 섬끼리 120m 이상 떨어지게, 스토리 순서대로 한 바퀴 항로가 되게
```
