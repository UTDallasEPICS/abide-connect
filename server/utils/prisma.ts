import { PrismaClient } from './generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

/**
 * The single shared Prisma client. Import this (`#server/utils/prisma`) rather
 * than constructing a `PrismaClient` anywhere else.
 *
 * The client is generated into `server/utils/generated/prisma` instead of
 * `node_modules` (see `prisma.config.ts`), which is why the import above is a
 * relative path and not `@prisma/client`. Re-run `pnpm prisma generate` after
 * editing anything in `prisma/schema/`.
 */

const prismaClientSingleton = () => {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL,
  })
  return new PrismaClient({ adapter })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>
} & typeof global

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

// Cached on globalThis in dev only: Nitro's HMR re-evaluates this module on
// every server-side edit, and a fresh PrismaClient per reload would leak SQLite
// connections until the dev server runs out of them. Production loads the
// module once, so the global isn't needed there.
if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
