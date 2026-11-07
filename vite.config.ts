import { defineConfig } from 'vitest/config';

const sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7);

export default defineConfig({
  define: {
    __BUILD_SHA__: JSON.stringify(sha),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/**/*.accept.test.ts', 'node_modules/**'],
  },
});
