# Codex 작업 지시서 (붙여넣기용)

> 시작 조건: Claude가 P0(스캐폴드 + `src/types/contracts.ts`)를 main에 푸시한 뒤. 아래 작업은 서로 다른 폴더만 건드리므로 **동시에 여러 개 실행 가능**합니다.
> 공통 규칙(모든 지시문 앞에 붙이기):
>
> ```
> 저장소: https://github.com/hjpapa/odyseey  (Vite + TypeScript + Three.js)
> 먼저 docs/PLAN.md, docs/STORY.md, src/types/contracts.ts 를 읽어.
> contracts.ts 의 타입은 절대 바꾸지 마. 바꿔야 하면 PR 설명에 제안만 적어.
> 지정한 폴더 밖의 파일은 수정하지 마.
> 브랜치 codex/<작업명> 에서 작업하고 `npm run build && npm test` 통과 후 PR 올려.
> 대상: 초등 1~3학년. 무섭거나 폭력적인 표현 금지(적은 '별가루로 사라진다').
> ```

---

## A1. 학습 콘텐츠 데이터 — 통째로 / 추천: Medium → 마지막 검수만 High
```
작업명: learning-data
수정 폴더: data/learning/
1) english.json: 단어 300개. 필드는 contracts.ts 의 EnglishWord
   (id, word, meaningKo, grade 1|2|3, topic, emoji, chapterHint?).
   주제: animals, colors, numbers, family, body, food, nature, sea, house, actions.
   스토리 연결 단어 우선 포함: sea, wave, boat, wind, sheep, eye, pig, lion, wolf, sun, cow,
   bow, home, king, queen, island, flower, cave, ship, star.
2) hanja.json: 한자능력검정 8급 50자 전부 + 7급 중 쉬운 30자. 필드 Hanja
   (id, char, hun 뜻, eum 음, grade, strokes, exampleWords[{word, reading, meaning}]).
   4장(家父母兄弟), 8장(人大小日月), 13장(山水木土門) 한자는 chapterHint 표기.
3) manners.json: 상황 60개. 필드 MannersScene
   (id, grade, category: greeting|thanks|sorry|turn|table|public|honorific|guest|honesty,
    situation 한 문장, choices 3개, answerIndex, praise, hint, chapterHint?).
   STORY.md 각 장에 '예절'이 있는 장면은 그 장 배경으로 1개 이상 만들어.
4) scripts/validate-learning.ts 로 스키마·중복·학년 분포(각 학년 최소 25%) 검사 + npm test 에 연결.
```

## A2. 수학·시계 문제 생성기 — 통째로 / 추천: Astra High
```
작업명: generators
수정 폴더: src/learning/generators/, tests/generators/
contracts.ts 의 QuestionGenerator 인터페이스 구현 (seed 기반 결정적 난수).
- math.ts: 학년별 규칙
  1학년: 합/차 20 이내, 음수 금지
  2학년: 두 자리 덧뺄셈(받아올림 포함), 곱셈구구 2·5·3·4단
  3학년: 세 자리 덧뺄셈, 곱셈구구 전체, (두 자리×한 자리), 나머지 없는 나눗셈
  스토리 문장형 템플릿 지원: "{n}마리 양 중 {m}마리가 나갔어요" 같은 템플릿 배열을 받는 옵션.
  오답 보기 3개는 '그럴듯한 실수'(받아올림 빠뜨림, ±1, 자리 바꿈)로 생성.
- clock.ts: 1학년 정각/30분, 2학년 5분 단위, 3학년 1분 단위 + 경과 시간(몇 시간/몇 분 후).
  문제 유형: read(시계 보고 시각 고르기), set(바늘 맞추기 정답 = {h,m}), elapsed.
  시침 각도는 분에 따라 비례 이동하도록 정답 각도 계산 함수 export.
- 테스트: 학년별 1000문제 생성해 범위·중복 보기·정답 포함 여부 검사.
```

## A3. 효과음·배경음 — 통째로 / 추천: Astra High
```
작업명: audio
수정 폴더: src/audio/
- zzfx 를 npm 으로 추가(MIT). sfx.ts 에 contracts.ts 의 SfxId 전부(약 40종) 프리셋.
  정답음은 밝고 짧게, 오답음은 부드럽고 슬프지 않게(아이용).
- sequencer.ts: WebAudio 스텝 시퀀서. 곡 데이터 = BgmTrack(bpm, mode, patterns, loop).
  악기: lyre(플럭), flute(사인+비브라토), drum(노이즈), bass. 페이드 인/아웃, 크로스페이드.
- tracks/*.ts: BgmId 10곡(title, sailing, memorySea, island, cave, boss, siren, ithaca,
  finalBoss, ending). 그리스풍 선법(도리안/믹솔리디안), 각 30~60초 루프.
- 첫 사용자 입력 전에는 AudioContext 를 만들지 않기(브라우저 자동재생 정책).
- dev 전용 페이지 /audio-test.html 에 모든 SFX·BGM 재생 버튼.
```

## A4. 블록 모델 빌더 — 통째로 / 추천: Astra High
```
작업명: models
수정 폴더: src/models/
로블록스풍 블록 캐릭터를 BoxGeometry/CylinderGeometry 조합으로 생성하는 순수 함수.
contracts.ts 의 ModelId 전부 구현, 각 함수는 () => THREE.Group,
캐릭터는 rig 규약(head, torso, armL, armR, legL, legR 이름의 자식, 관절 위치 원점) 준수.
- 캐릭터: odysseus(커스터마이즈 슬롯: helmet, cape, shieldColor), calypso, hermes, ino,
  nausicaa, aeolus, circe, tiresias, telemachus, penelope, eumaeus, athenaOwl, crewman(색 변형 4종)
- 적/보스: polyphemus, lotusEater, laestrygonian, circePig, scylla(머리 6개 개별 노드),
  charybdis(소용돌이), siren, greekSoldier, suitor, antinous, poseidon
- 소품: raft, ship, sheep, cow, lotus, molyFlower, windBag, bow, axe, olive tree, rock, column 등 30종
- 재질은 MeshToonMaterial 공용 팔레트(src/models/palette.ts) 사용, 드로콜 줄이기 위해 병합 가능하면 병합.
- dev 페이지 /model-gallery.html 에 전체 모델 회전 미리보기.
```

---

## B1. 챕터 대사·목표 데이터 — 통째로 / 추천: Medium (P1 끝난 뒤)
```
작업명: chapter-data
수정 폴더: data/chapters/
docs/STORY.md 를 contracts.ts 의 ChapterData 로 변환해 ch01.json ~ ch17.json 생성.
- titleCard.childText 에는 STORY.md 의 '아이 원문'을 글자 하나 바꾸지 말고 그대로 복사.
- 대사는 한 줄 25자 이내, 초등 저학년 어휘. 음성 없음(텍스트만).
- objectives, quizSlots(과목·형식·위치 태그), bossId, bgmId 를 STORY.md 의 '게임'·'학습' 항목에 맞춰 채워.
- 원작 이름 뒤 아이 표기 병기: 폴리페모스(폴리페오스), 몰리(욜리꽃).
- validate 스크립트로 17개 파일 스키마 검사 + 아이 원문 일치 검사(STORY.md 파싱 비교).
```

## B2. 섬 레이아웃 초안 — 통째로 / 추천: Medium
```
작업명: island-layouts
수정 폴더: data/islands/
contracts.ts 의 IslandLayout 으로 섬 14곳 데이터: 지형 파라미터(크기·높이·노이즈 seed),
구역(zone) 목록, 스폰·체크포인트·지혜의 문·부엉이 신전·보물상자 좌표, 소품 배치.
동선은 '시작 → 탐험 → 목표 → 보스' 한 방향 + 샛길 1~2개. 섬 하나 5분 내외 분량.
```

## 보스 패턴 (함께 작업) — 추천: Astra High
```
작업명: boss-<이름>
수정 폴더: src/enemies/bosses/<이름>.ts 만
src/enemies/bosses/polyphemus.ts 를 템플릿으로 삼아 같은 BossPattern 구조로 구현.
STORY.md 해당 장의 '게임' 항목을 따르고, 약점 페이즈에서 learning.ask() 호출.
체력·속도 수치는 constants 로 빼 두기(튜닝은 Claude가 함).
```
