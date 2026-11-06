import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  test: {
    include: ['__tests__/**/*.test.ts'],
    exclude: ['node_modules/**', 'node_modules.nosync/**'],
    setupFiles: ['./__tests__/setup.ts'],
    environment: 'node',
  },
});
