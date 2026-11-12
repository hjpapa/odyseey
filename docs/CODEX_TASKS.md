# Codex 작업 지시서 (붙여넣기용)

각 작업은 정해진 폴더만 건드리고, 완료 여부는 수용 테스트(`npm run test:accept -- <폴더>`)가 판정합니다.

| 작업 | 상태 | 수정 폴더 | 추천 모델 | 완료 판정 |
|---|---|---|---|---|
| A1 학습 데이터 | ✅ 완료 (PR #1) | `data/learning/` | Medium → 마지막에 High 검수 1회 | `npm run test:accept -- tests/learning` |
| A2 문제 생성기 | ✅ 완료 (PR #1) | `src/learning/generators/` | Astra High | `npm run test:accept -- tests/generators` |
| A3 효과음·배경음 | ✅ 완료 (PR #1) | `src/audio/` | Astra High | `npm run test:accept -- tests/audio` |
| A4 블록 모델 | ✅ 완료 (PR #1·#2) | `src/models/` | Astra High | `npm run test:accept -- tests/models` |
| B1 챕터 데이터 (3~17장) | ✅ 완료 (PR #1) | `data/chapters/` | Medium | `npm run test:accept -- tests/chapters` |
| B2 섬 레이아웃 (12곳) | ✅ 완료 (PR #4) | `data/islands/` | Medium | `npm run test:accept -- tests/islands` |
| **C1 보스 패턴 7종** | **▶ 지금** | `src/enemies/bosses/` | High (논리·밸런스) | `npm run test:accept -- tests/bosses` |
| **C2 미니게임 8종** | **▶ C1 다음** | `src/story/minigames/` | High (조작감·화면) | `npm run test:accept -- tests/minigames` |

> **P2 엔진 완료 (2026-11-12)**: 보스전·버티기·바다 항해가 들어가 1~17장 모두 끝까지 진행됩니다.
> 아직 전용 패턴이 없는 보스 7종은 '기본 보스 패턴'으로, 미니게임 8종은 '준비 중' 안내로 넘어갑니다 — C1·C2 가 이것을 채웁니다.

> **P1 완료 (2026-11-07)**: 1·2장은 Claude 가 만들어 두었습니다 — `data/chapters/ch01.json`, `ch02.json`,
> `data/islands/ogygia.json`, `stormSea.json`. Codex 는 이 네 파일을 **수정하지 말고 형식·말투의 견본**으로 쓰세요.
> 지금 Codex 에서 B1 을 이미 돌리고 있다면 ch01·ch02 결과는 버리고 ch03~ch17 만 PR 에 넣으면 됩니다.
>
> **눈으로 확인하는 법** (`npm run dev` 후): `http://localhost:5173/?play=ch03&fast=1` — 그 장을 바로 시작하고 대사를 빨리 넘깁니다.
> 그 장의 섬 데이터가 아직 없으면 '준비 중' 화면이 나옵니다.

---

## Codex 실행 방법 (로컬, 한 폴더에서 차례로)

- Codex 와 Claude 는 **같은 폴더 `C:\code\code15(odyseey)` 에서 번갈아** 작업합니다 (동시에 하지 않음).
- Codex 차례: main 에서 `git switch -c codex/<작업명>` → 작업 → **커밋까지만** (push·PR 은 Claude 가 확인 후).
- 끝나면 Claude 에게 "<작업명> 끝났어" — Claude 가 테스트·브라우저로 확인하고 PR 을 올린 뒤 병합 여부를 묻습니다.
- 눈으로 확인: `npm run dev` 후 `http://localhost:5173/?play=ch03&fast=1` (그 장을 바로 시작, 대사 빨리 넘기기).
  브라우저 창이 가려져 있으면 게임이 멈춰 있으니 창을 띄워 두고 확인하세요.

## 공통 규칙 (모든 지시문 맨 앞에 붙이기)

```
저장소: https://github.com/hjpapa/odyseey  (Vite + TypeScript + Three.js, Node 24)
먼저 읽을 것: docs/PLAN.md, docs/STORY.md, src/types/contracts.ts, 그리고 이 작업의 수용 테스트 파일.

규칙:
- src/types/contracts.ts, tests/ 아래 기존 파일, package.json 은 수정 금지.
  계약을 바꿔야 할 것 같으면 PR 설명에 '계약 변경 제안'으로만 적어.
- 지정한 폴더 밖의 파일은 수정하지 마. (테스트를 더 쓰고 싶으면 tests/<작업폴더>/ 에 새 파일로 추가)
- main 에서 브랜치 codex/<작업명> 을 만들어 작업하고, 마지막에 커밋한다 (push·PR 은 하지 않는다).
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
수정 폴더: data/chapters/ (ch03.json ~ ch17.json 새로 만들기. ch01·ch02 는 이미 있으니 수정 금지 — 견본으로 읽기)
수용 테스트: tests/chapters/chapters.accept.test.ts (+ tests/chapters/chapters.test.ts)
형식: ChapterData (contracts.ts 9장). 원본: docs/STORY.md

- titleCard.childText = src/story/childStory.ts 의 CHILD_STORY 와 글자 하나까지 같게 (복사해서 붙이기)
- 섬·보스·학습 과목은 tests/chapters/chapters.accept.test.ts 의 EXPECT 표를 따름 (= PLAN.md 3-4)
- 3장 첫 장면은 회상 속이라는 느낌으로 (예: caption '…그날, 외눈 거인의 섬에서'), 11장 끝에 회상 끝,
  12장 시작에 해변에서 눈을 뜨는 장면
- 이름 병기: 폴리페모스(폴리페오스), 몰리(욜리꽃) — 아이 표기를 지움 없이 함께
- 미니게임 목표의 target 은 contracts.ts 의 MINIGAME_IDS 중에서 (STORY.md 의 '게임' 항목과 맞는 것)
- 엔진 동작 규칙 (ch01.json 을 보면 쉬움):
  · talk 목표는 그 npc 의 talk 장면을 재생한 뒤 완료 / reach 목표는 zone 에 들어가면 완료
  · collect·rescue 목표는 섬의 collectibles 에서 item 이름이 같은 것을 count 개 주우면 완료
  · defeat 목표의 적 그룹은 그 목표가 켜질 때 나타난다
  · quiz 목표: placement 'gate' 면 섬의 지혜의 문에서, 그 밖은 목표가 켜지자마자 묻는다
  · enterZone 장면은 한 번만 재생 (바다 코스에서는 그 zone 의 z 위치를 지날 때)
- 대사 한 줄 25자 권장(30자 이내), caption 40자 이내, 목표 text 20자 이내
- 퀴즈 자리: 장마다 2개 이상, 보스 장은 placement 'boss' 1개 이상, 12장은 kind 'order'(이야기 순서),
  16장은 4과목 이상 종합. npc·story 자리는 장면의 quiz step 이나 quiz 목표에서 사용
- 목표 target 이름 규칙 (B2 섬 데이터와 맞춰야 함):
  reach → zone id, talk → npc id, collect/rescue → 아이템 이름(예: 'log', 'moly', 'crew'),
  defeat → 적 그룹 id, boss → BossId
- 학습 데이터 id 를 ids 로 고정할 때는 data/learning 에 실제로 있는 id 만
```

## B2. 섬 레이아웃 초안 — B1 병합 후 / 추천: Medium

```
작업명: island-layouts   (B1 이 main 에 들어간 뒤 시작)
수정 폴더: data/islands/ (나머지 12곳 새로 만들기. ogygia·stormSea 는 이미 있으니 수정 금지 — 견본으로 읽기)
수용 테스트: tests/islands/islands.accept.test.ts (+ tests/islands/islands.test.ts)
형식: IslandLayout (contracts.ts 8장)

- 동선: 시작 → 탐험 → 목표 → 보스, 샛길 1~2개, 섬 하나 5분 내외
- 챕터 데이터와 연결: gate 의 quizSlot, boss, 목표 target(zone·npc·collectible·enemy 그룹)이 모두 존재해야 함
- 미니게임 목표가 섬 위 특정 장소에서 시작해야 하면, 미니게임 id 와 같은 id 의 zone 을 만든다 (예: ogygia 의 raftBuild)
- 섬: 체크포인트 1·부엉이 신전 1·보물상자 2 이상 / 바다 코스: 체크포인트 2 이상
- 허브 맵에서 섬끼리 120m 이상 떨어지게, 스토리 순서대로 한 바퀴 항로가 되게
- 지형 생성기(src/world/terrain.ts) 특징:
  · 이웃 칸 높이 차이를 0.5m 이하로 다듬기 때문에 지형만으로는 길을 막을 수 없다
  · 지혜의 문 뒤 구역은 boulder 소품을 둥글게 둘러 막는다 (간격 3m, 문 양옆 기둥까지 빈틈없이 — ogygia.json 의 비밀 숲 참고)
  · 좌표는 섬 반지름 - beachWidth×0.3 안쪽, 중요한 자리(시작점·문·NPC·zone 중심)는 자동으로 평평해진다
  · 바다 코스(kind seaCourse)는 x 가 ±width/2, z 가 0~length
```

## C1. 보스 패턴 7종 — 통째로 맡김 / 추천: High

```
작업명: boss-patterns   (main 에서 git switch -c codex/boss-patterns)
수정 폴더: src/enemies/bosses/ 만 (새 파일 7개 + index.ts 의 BOSSES 에 등록)

먼저 읽을 것:
- src/types/contracts.ts 10장 (BossContext · BossDef · BossFactory) — 규칙 그대로
- 견본 src/enemies/bosses/polyphemus.ts, 그리고 generic.ts · index.ts
- docs/STORY.md 해당 장의 '게임' 항목, data/chapters/<장>.json 의 boss 퀴즈 자리
- tests/bosses/bosses.test.ts (모든 보스가 지켜야 할 규칙), tests/bosses/bosses.accept.test.ts

만들 것 (각 파일 default export BossFactory):
- lotusKing (4장 연꽃 대장): 꽃가루 'magic' 예고 공격 + lotusEater 졸개 부르기, 느릿느릿 졸린 공격
- laestrygonianKing (6장 거인 왕): 큰 바위 'rock' 여러 개 던지기 + 발 구르기 'stomp'
- circe (7장 마녀 키르케): 물약 'magic' 원형 공격, pig 졸개(최대 3)
- helios (9장 태양신 헬리오스): 하늘에 떠 있음 (moveTo 의 y=6, melee:false) — 'lightning' 예고 공격, 칼로는 못 때리고 약점 퀴즈로만
- sirenQueen (11장 세이렌 여왕): 음표 'magic' 이 줄지어 떨어짐, siren 졸개
- soldierCaptain (14장 병사 대장): 빠른 돌진(moveTo) 뒤 'stomp', greekSoldier 졸개
- antinous (16장 구혼자 대장, 최종 보스): 단계가 있음 (체력 절반 아래 phase('angry')), suitor 졸개.
  16장은 boss 퀴즈 자리가 과목별 5개라 약점이 5번쯤 드러나게 (maxHp 14~18, quizDamage 3~4)

규칙:
- 공격은 반드시 ctx.telegraph 로 예고 (delay 0.9초 이상, radius 1.2~3.5m), 맞으면 하트 1
- 30~40초마다 ctx.weak() — 3분 안에 이길 수 있게 (테스트가 검사)
- three.js·DOM 을 직접 만지지 말고 BossContext 만 쓴다
- 말풍선(say)은 20자 이내, 아이 눈높이, 무섭지 않게. 이름은 원작 이름 (아이 표기 병기 가능)

완료 조건:
- npm run typecheck && npm test && npm run build
- npm run test:accept -- tests/bosses  (지금 실패 1개 → 0개)
- 눈으로: npm run dev → http://localhost:5173/?play=ch04&fast=1 처럼 각 장의 보스전을 직접 해 보기
- 마지막에 커밋 (push·PR 은 하지 않음)
```

## C2. 섬 미니게임 8종 — 통째로 맡김 / 추천: High

```
작업명: island-minigames   (main 에서 git switch -c codex/island-minigames)
수정 폴더: src/story/minigames/ 만 (새 파일 8개 + index.ts 의 ISLAND_MINIGAMES 에 등록)

먼저 읽을 것:
- 견본 src/story/minigames/raftBuild.ts 와 index.ts
- src/game/islandStage.ts 의 공개 멤버: svc(audio·ui·learning), world, player, fx, scene,
  cinematic(카메라 고정), block()/unblock(), signal(장면을 나가면 중단), ask(퀴즈 자리, 'story')
- docs/STORY.md 해당 장 '게임' 항목, data/chapters/<장>.json, data/islands/<섬>.json 의 미니게임 zone
- tests/minigames/minigames.accept.test.ts

만들 것 (형식: (stage: IslandStage, at: Vector3) => Promise<void>):
- sheepEscape (3장): 양 무리에 섞여 동굴을 빠져나가기 — 거인이 돌아볼 때 멈추기 (빨강불·초록불)
- windSail (5장): 바람 화살표 쪽으로 돛 돌리기 (← → / 화면 버튼), 이타카가 보일 때까지
- rhythmShield (11장): 3줄로 떨어지는 음표를 박자에 맞춰 방패로 막기 — 목소리 없이 악기 소리만
- ballGame (12장): 나우시카와 공 주고받기 (타이밍 맞춰 누르기)
- hideWeapons (15장): 궁전 무기 6개를 창고로 옮기기 (집어서 놓기)
- bowString (16장): 활시위 걸기 — 움직이는 게이지가 가운데일 때 누르기 3번
- axeArchery (16장): 도끼 12개 구멍이 일직선일 때 쏘기 (흔들리는 조준을 멈추는 타이밍) — 12 세기와 연결
- feast (17장): 잔치 식사 예절 — 상황 3개에서 올바른 행동 고르기 (stage.ask 로 manners 'table' 문제 가능)

규칙 (raftBuild 와 같게):
- 시작에 stage.block(), 끝에 stage.unblock() — 어떤 경우에도 반드시 끝난다 (실패하면 다시 하기, 벌 없음)
- 길어도 1분 안팎, 아이가 세 번 안에 성공할 수 있게
- 키보드(Space·←·→)와 화면 버튼을 둘 다 지원. 리스너는 { signal: stage.signal } 로 등록
- 화면 UI 는 svc.ui.root 에 'mini-panel' 클래스로 붙이고 끝나면 지운다. 카메라는 stage.cinematic
- 소리는 svc.audio.sfx (SFX_IDS 안에서). 목소리 없음
- src/game · src/play · src/ui · src/types 는 수정 금지 (엔진이 더 필요하면 커밋 메시지에 '엔진 변경 제안'으로 적기)

완료 조건:
- npm run typecheck && npm test && npm run build
- npm run test:accept -- tests/minigames  (지금 실패 1개 → 0개)
- 눈으로: 각 장에서 미니게임을 직접 해 보기 (?play=ch03&fast=1 등, 브라우저 창을 띄워 둔 채로)
- 마지막에 커밋 (push·PR 은 하지 않음)
```
