import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Builds the throwaway test database once, before any test file runs.
 *
 * The schema is applied by replaying `prisma/migrations/*` in order rather than
 * by shelling out to `prisma migrate deploy`: it is a couple of seconds faster,
 * needs no CLI, and — more importantly — it is the same DDL production runs, so
 * a column that exists only in `prisma/schema/*.prisma` and never made it into
 * a migration fails here the way it would fail on deploy.
 */
const root = fileURLToPath(new URL('../../', import.meta.url))
const dbPath = join(root, 'node_modules/.tmp/reporting-test.db')

export async function setup() {
  rmSync(dbPath, { force: true })
  rmSync(`${dbPath}-journal`, { force: true })
  mkdirSync(dirname(dbPath), { recursive: true })

  // `node:sqlite` rather than the app's `better-sqlite3`: this only has to
  // execute DDL, and the built-in avoids depending on a native module that pnpm
  // installs as a transitive dependency of the Prisma adapter.
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA foreign_keys = OFF')

  const migrationsDir = join(root, 'prisma/migrations')
  const migrations = readdirSync(migrationsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()

  for (const migration of migrations) {
    const sql = readFileSync(join(migrationsDir, migration, 'migration.sql'), 'utf8')
    try {
      db.exec(sql)
    }
    catch (error) {
      throw new Error(`Migration ${migration} failed to apply: ${(error as Error).message}`)
    }
  }

  db.close()
}

export async function teardown() {
  rmSync(dbPath, { force: true })
  rmSync(`${dbPath}-journal`, { force: true })
}
