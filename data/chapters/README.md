# 챕터 데이터 연결표

아이 원문은 CHILD_STORY와 같고, 3~11장만 회상이다. 1·2장은 P1의 NPC·목표·퀴즈 자리·미니게임 ID를 유지한다. 3~17장에 필요한 섬 배치는 B2에서 이 표와 JSON의 장면 트리거를 함께 연결한다.

| 장 | 섬 | 장소·대화·수집·전투 대상 | 미니게임 | 퀴즈 자리 |
|---|---|---|---|---|
| ch01 | ogygia | talk: hermes, defeat: shadows, collect: log, talk: calypso | raftBuild | gate-1 (gate), raft-math (story), farewell (npc) |
| ch02 | stormSea |  | waveRunner | ino-1 (npc), ino-2 (npc), ino-final (story) |
| ch03 | cyclops | reach: cyclops-pen, boss: polyphemus | sheepEscape | gate-cave (gate), boss-count (boss) |
| ch04 | lotus | defeat: lotus-guards, boss: lotusKing, rescue: crew |  | gate-family (gate), boss-memory (boss) |
| ch05 | aeolia | talk: aeolus | windSail | bag-manners (npc), watch-clock (gate) |
| ch06 | laestrygonia | boss: laestrygonianKing, rescue: crew |  | gate-boats (gate), boss-groups (boss) |
| ch07 | aeaea | talk: hermes, collect: moly, boss: circe, rescue: crew |  | gate-animals (gate), boss-animals (boss) |
| ch08 | underworld | reach: shadow-lanterns, talk: tiresias |  | gate-light (gate), prophet-manners (npc) |
| ch09 | thrinacia | collect: fruit, boss: helios |  | gate-sundial (gate), return-clock (gate), boss-time (boss) |
| ch10 | strait | reach: strait-safe-lane, boss: scylla, reach: strait-exit |  | gate-drops (gate), boss-subtract (boss) |
| ch11 | sirens | boss: sirenQueen | rhythmShield | crew-thanks (npc), gate-words (gate), boss-word (boss) |
| ch12 | scheria | reach: scheria-palace, talk: alcinous | ballGame | guest-manners (npc), story-order (story), recap-english (story) |
| ch13 | ithaca | reach: ithaca-olive-path, talk: eumaeus |  | gate-landscape (gate), gate-home (gate) |
| ch14 | ithaca | defeat: ithaca-outpost-guards, reach: ithaca-hidden-dock, boss: soldierCaptain |  | gate-outposts (gate), boss-division (boss) |
| ch15 | ithaca | talk: telemachus | hideWeapons | family-manners (npc), meeting-clock (story) |
| ch16 | ithacaPalace | defeat: palace-suitors, boss: antinous | bowString, axeArchery | gate-axes (gate), boss-math (boss), boss-english (boss), boss-hanja (boss), boss-clock (boss), boss-manners (boss) |
| ch17 | ithacaPalace | talk: penelope | feast | feast-thanks (story), feast-table (story) |

collect/rescue 대상은 collectible의 item, defeat는 적 그룹 id, talk는 NPC id, reach는 zone id다. gate 퀴즈 자리는 IslandLayout.gates의 quizSlot으로 연결하고, boss 퀴즈는 보스 약점 페이즈에서 출제한다. npc/story 퀴즈는 이미 장면이나 quiz 목표에서 참조한다.

12장의 story-order는 3~11장 모험의 순서를 되짚는 자리이며 kind=order다. 16장은 다섯 과목의 보스 퀴즈 자리를 제공한다. 9장 완료 보상에는 bow, 17장에는 freeExplore를 둔다. 해당 보상과 미니게임의 실제 실행은 진행 엔진이 담당한다.
