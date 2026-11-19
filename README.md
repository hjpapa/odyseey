# 오디세이 (Odyseey)

아이가 쓴 17장의 이야기로 만드는 로블록스 스타일 오픈월드 액션 RPG.
초등 1~3학년 영어단어 · 한자 · 수학 · 아날로그 시계 · 예절 학습이 모험 속에 들어 있어요.

현재 1·2장 플레이와 그리스 신화풍 캐릭터 36종이 구현되어 있습니다. 이후 장과 배경 소품 일부는 개발 중입니다.

- 계획: [docs/PLAN.md](docs/PLAN.md)
- 스토리: [docs/STORY.md](docs/STORY.md)
- Codex 작업 지시서: [docs/CODEX_TASKS.md](docs/CODEX_TASKS.md)
- 배포: https://odyseey1924.vercel.app

## 개발

```bash
npm ci
npm run dev          # http://localhost:5173
npm test             # 형식 검사 (항상 통과)
npm run test:accept  # Codex 작업 완료 검사 (작업 전에는 실패가 정상)
npm run build
```

개발용 페이지: `/dev/model-gallery.html` (블록 모델), `/dev/audio-test.html` (효과음·배경음)

개발용 지름길: `/?play=ch02&fast=1` — 타이틀을 건너뛰고 그 장을 바로 시작, 대사를 빨리 넘깁니다 (개발 서버에서만 동작).
`/?map=1` 바다 지도, `/?ending=1` 엔딩(이야기책·크레딧·성적표)을 바로 엽니다.
브라우저 창이 가려져 있으면 그림이 멈추므로, 콘솔에서 `game.debugStep(초)` 로 시간을 진행해 확인할 수 있습니다.

터치 자동 플레이 (새 게임부터 엔딩까지, 개발 서버 콘솔):

```js
localStorage.removeItem('odyseey.save.v1'); location.href = '/';
// 새로 열린 뒤
const bot = await import('/dev/touchBot.ts');
bot.start({ grade: 2 });             // 서툰 플레이는 { grade: 1, wrongRate: 0.5, skill: 'clumsy' }
bot.summary();                       // 장별 기록, 못 누른 버튼, 오류
```

캐릭터 검수: `/src/models/review.html` (개발 서버 전용, 회전·전후 비교·관절 확인).
미술 방향과 검증 범위는 [캐릭터 작업 기록](src/models/ART_DIRECTION.md)을 참고하세요.
