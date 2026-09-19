import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [['tests/markdown.test.ts', 'jsdom']],
    include: ['tests/**/*.test.ts'],
    clearMocks: true
  }
})
