// 수용 테스트(acceptance): Codex 일괄 작업이 '완성'되었는지 검사합니다.
// 작업이 끝나기 전에는 실패하는 것이 정상이며, 기본 테스트(npm test)·CI 에는 포함되지 않습니다.
//   npm run test:accept                    → 전체
//   npm run test:accept -- tests/learning  → 특정 작업만
import { defineConfig } from 'vitest/config';
import base from './vite.config';

export default defineConfig({
  ...base,
  test: {
    environment: 'node',
    include: ['tests/**/*.accept.test.ts'],
    exclude: ['node_modules/**'],
  },
});
