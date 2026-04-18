import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/domain/**/*.ts',
        'src/store/**/*.ts',
        'src/components/**/*.view-model.ts',
      ],
      exclude: [
        'src/domain/index.ts',
        'src/**/*.test.ts',
        'src/test/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        'src/domain/**': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
      },
    },
  },
});
