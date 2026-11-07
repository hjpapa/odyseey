# 블록 모델

`modelRegistry`에 사람형 27개, 동물·괴물 9개, 소품 55개를 등록한다. 호출할 때마다 독립된 Group/관절/메시를 만들고 재질과 기본 지오메트리는 공유한다.

사람형은 허리 아래 몸통과 목·어깨·엉덩이 관절, handR/handL/headTop/back 부착점을 갖는다. 정면은 +Z, 왼팔은 +X다. 어깨를 돌리면 손과 장비가 함께 움직인다. 서 있는 모델은 실제 경계를 기준으로 발바닥을 y=0에 놓고 height를 계산한다. 장비 소품의 원점은 바닥이 아닌 손잡이이므로 부착할 때 추가 원점 보정이 필요 없다.

오디세우스의 투구는 headTop, 망토는 back 아래에 있고 none/null이면 비어 있다. 선택한 튜닉·망토·방패 색도 반영한다. 부하·구혼자·병사·연꽃족은 variant 0~3에 따라 색이 다르다.

공용 재질은 `palette.ts`에서 관리한다. 개별 모델을 제거할 때 공유 material/geometry를 임의로 dispose하지 않는다. 장면이 더 이상 어떤 모델도 사용하지 않을 때 전체 자원을 정리한다.

검증: `npm test -- tests/models`, `npm run test:accept -- tests/models`, `/dev/model-gallery.html`. 스킬라는 여섯 목 관절 아래에 각각 머리가 연결되어 있다.
