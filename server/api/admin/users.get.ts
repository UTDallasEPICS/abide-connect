import { sumHours } from '#shared/utils/hours'
import { getQuery, defineEventHandler } from 'h3'
import { requireRole } from '#server/utils/requireRole'

// ---- Config ----
const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50
const ALL_ROLES = 'ALL'
// Roles we report individual counts for in the response's `counts` object
const COUNTABLE_ROLES = ['VOLUNTEER', 'ADMIN'] as const

// ---- Helpers ----

/**
 * Type guard used with `.filter()` to strip `undefined` entries out of an
 * array while letting TypeScript narrow the resulting type.
 */
function removeUndefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

// ---- Query parsing ----

/**
 * Parses and clamps `page` / `pageSize` from the query string.
 * - page is never less than DEFAULT_PAGE
 * - pageSize is clamped to [1, MAX_PAGE_SIZE]
 */
function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(
    DEFAULT_PAGE,
    Number.parseInt(String(query.page ?? DEFAULT_PAGE), 10),
  )
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(String(query.pageSize ?? DEFAULT_PAGE_SIZE), 10)),
  )
  return { page, pageSize }
}

/**
 * Builds a Prisma `where` clause that matches users whose name or email
 * contains the given search string. Returns undefined if there's nothing
 * to search for, so it can be filtered out of an AND clause.
 */
function buildSearchClause(search: string): UserWhereInput | undefined {
  if (!search) return undefined
  return {
    OR: [{ name: { contains: search } }, { email: { contains: search } }],
  }
}

/**
 * Builds a Prisma `where` clause that matches users with an active
 * assignment of the given role. Returns undefined for the "ALL" sentinel
 * (or an empty role), meaning "don't filter by role".
 */
function buildRoleClause(role: string): UserWhereInput | undefined {
  if (!role || role === ALL_ROLES) {
    return undefined
  }
  return {
    roles: {
      some: { role, active: true },
    },
  }
}

/** Counts users matching the current search, further filtered by a single role. */
function countUsersByRole(searchClause: UserWhereInput | undefined, role: string) {
  return prisma.user.count({
    where: {
      AND: [searchClause, buildRoleClause(role)].filter(removeUndefined),
    },
  })
}

/**
 * Sums approved hour logs into a single total, rounded to two decimals — the
 * rows are floats, so adding them raw can surface noise (12.299999999999999)
 * in a column that reads as a plain hour count.
 */
function calculateApprovedHours(hourLogs: { hours: number }[] = []) {
  return sumHours(hourLogs.map(log => log.hours))
}

/**
 * Maps a raw Prisma user record (with roles + volunteer hour logs included)
 * into the shape returned to the client. Only active roles are included,
 * and they're sorted alphabetically for a stable, readable display order.
 */
function toUserSummary(user: {
  id: string
  name: string | null
  email: string
  imageURL: string | null
  roles: { role: string, active: boolean }[]
  volunteer: { hourLogs: { hours: number }[] } | null
}) {
  return {
    id: user.id,
    name: user.name ?? 'Unnamed User',
    email: user.email,
    roles: user.roles
      .filter(r => r.active)
      .map(r => r.role)
      .sort((a, b) => a.localeCompare(b)),
    hours: calculateApprovedHours(user.volunteer?.hourLogs ?? []),
    avatarUrl: user.imageURL,
  }
}

// ---- Handler ----

/**
 * GET handler for the paginated user list. Admin only.
 *
 * Living under `server/api/admin/` grants nothing on its own — the directory is
 * a convention, not a boundary, and the global middleware is a no-op. The
 * `requireRole` call below is what stops this being an unauthenticated dump of
 * the org's contact list, since the response carries every user's name and
 * email.
 *
 * Query params:
 *   - search: filters by name/email substring
 *   - role: filters to users with an active role, or ALL_ROLES for no filter
 *   - page, pageSize: standard pagination controls
 *
 * Response includes the page of users, pagination info, and per-role
 * counts (for populating role filter tabs/badges in the UI).
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const query = getQuery(event)
  const search = String(query.search ?? '').trim()
  const role = String(query.role ?? ALL_ROLES)
  const { page, pageSize } = parsePagination(query)

  const searchClause = buildSearchClause(search)
  const roleClause = buildRoleClause(role)
  const where: UserWhereInput = {
    AND: [searchClause, roleClause].filter(removeUndefined),
  }

  const [total, roleCounts, users, allCount] = await Promise.all([
    // Total users matching the current search + role filter
    prisma.user.count({ where }),
    // Per-role counts (search filter only, ignoring the active role filter)
    Promise.all(COUNTABLE_ROLES.map(role => countUsersByRole(searchClause, role))),
    // The actual page of users, with their roles and approved hour logs
    prisma.user.findMany({
      where,
      include: {
        roles: true,
        volunteer: {
          include: {
            hourLogs: {
              where: { approvalStatus: 'APPROVED' },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    // Count matching just the search (ignoring role) for the "All" tab
    prisma.user.count({
      where: { AND: [searchClause].filter(removeUndefined) },
    }),
  ])

  const counts = {
    all: allCount,
    ...Object.fromEntries(
      COUNTABLE_ROLES.map((role, index) => [role.toLowerCase(), roleCounts[index]]),
    ),
  }

  return {
    users: users.map(toUserSummary),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts,
  }
})
