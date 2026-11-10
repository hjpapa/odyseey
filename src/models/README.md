# 블록 모델

`modelRegistry`(registry.ts)에 ModelId 91개를 모두 등록한다. 호출할 때마다 독립된 Group/관절/메시를 만들고 재질과 기본 지오메트리는 공유한다.

| 묶음 | 파일 | 개수 | 출처 |
|---|---|---|---|
| 사람형·동물/괴물 | `humanoids.ts`, `creatures.ts`, `geometry.ts`, `palette.ts` | 27 + 9 | 그리스 신화 캐릭터 세트 (PR #2) — [ART_DIRECTION.md](ART_DIRECTION.md) |
| 장비 (손에 드는 것) | `equipment.ts` | 7 | 그리스 신화 캐릭터 세트 (PR #2) |
| 배경 소품 | `props.ts`, `parts.ts`, `propPalette.ts` | 48 | 배치 A4 (PR #1) |

## 규약

- 사람형은 허리 아래 몸통과 목·어깨·엉덩이 관절, handR/handL/headTop/back 부착점을 갖는다. 정면은 +Z, 왼팔은 +X다.
- **손은 비어 있다.** 칼·방패는 엔진(`src/play/player.ts`)이 붙인다. 장비 모델의 원점은 손잡이다.
- 서 있는 모델과 소품은 실제 경계 기준으로 발바닥이 y=0, `userData.height`·`radius` 는 실제 크기다.
- 오디세우스의 투구는 headTop, 망토는 back 아래에 있고 none/null 이면 비어 있다. 부하·구혼자·병사·연꽃족은 variant 0~3 에 따라 색이 다르다.
- 공유 material/geometry 는 개별 모델을 지울 때 dispose 하지 않는다.

## 엔진이 소품에 기대는 것 (모델을 바꿀 때 확인)

엔진은 아래 부위가 없어도 동작하도록 보완하지만, 있으면 그것을 쓴다.

| 소품 | 엔진 동작 | 모델에 없을 때 |
|---|---|---|
| `chest` | `lid` 관절을 돌려 연다 | 뚜껑이 안 움직임 |
| `wisdomGate` | 폭 5.6m 로 맞춤, `barrier` 를 열릴 때 숨김 | 엔진이 반투명 막을 붙임 |
| `owlShrine` | `glow` 고리를 다 풀면 숨김 | 엔진이 고리를 붙임 |
| `checkpointFlag` | `flag` 메시 색을 바꿈 | 엔진이 금빛 고리만 표시 |
| `raft` | 긴 쪽을 +Z 로 맞춤, 높이 0.9m 위 부분(돛대·돛)을 따로 다룸 | — |
| 부딪히는 소품 | 충돌 반지름보다 작으면 최대 2배까지 키움 (`src/world/props.ts` 의 SOLID_RADIUS) | — |

검증: `npm test -- tests/models`, `npm run test:accept -- tests/models`, `/dev/model-gallery.html`, `/src/models/review.html`.
