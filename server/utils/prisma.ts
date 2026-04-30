import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from './generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const normalizeDatabaseUrl = (url?: string) => {
  if (!url) return url
  if (!url.startsWith('file:')) return url

  const sqlitePath = url.slice(5)
  if (path.isAbsolute(sqlitePath)) return url

  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  const projectRoot = import.meta.url.includes(`${path.sep}.output${path.sep}`)
    ? path.resolve(moduleDir, '..', '..', '..', '..')
    : process.cwd()

  return `file:${path.resolve(projectRoot, sqlitePath)}`
}

const prismaClientSingleton = () => {
  const adapter = new PrismaBetterSqlite3({
    url: normalizeDatabaseUrl(process.env.DATABASE_URL)
  })
  return new PrismaClient({ adapter })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
