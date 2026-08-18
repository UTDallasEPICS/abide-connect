import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Test runner for the reporting suite.
 *
 * The aliases mirror the ones Nuxt generates into `.nuxt/tsconfig.*.json`, so a
 * test can import server and shared modules by the same specifier the app uses
 * (`#server/...`, `#shared/...`) rather than by a relative path that would then
 * have to be updated whenever a file moves.
 *
 * `pool: 'forks'` and `singleFork` because the integration tests share one
 * SQLite file and one Prisma client; running them in parallel threads would
 * have several workers writing the same fixture rows at once.
 */
const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '#server': `${root}server`,
      '#shared': `${root}shared`,
      '~~': root,
      '~': `${root}app`,
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/setup/global-setup.ts'],
    setupFiles: ['tests/setup/h3-globals.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    env: {
      // Every test runs against a throwaway database built from the real
      // migrations, never the developer's dev.db.
      DATABASE_URL: `file:${root}node_modules/.tmp/reporting-test.db`,
      TZ: 'UTC',
    },
  },
})
