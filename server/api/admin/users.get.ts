import { getQuery, defineEventHandler } from 'h3'

// ---- Config ----
const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50
const ALL_ROLES = 'ALL'

const COUNTABLE_ROLES = ['VOLUNTEER', 'ADMIN'] as const

// ---- Helpers ----

function removeUndefined<T>(
  value: T | undefined
): value is T {
  return value !== undefined
}

// ---- Query parsing ----

function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(
    DEFAULT_PAGE,
    Number.parseInt(String(query.page ?? DEFAULT_PAGE), 10)
  )

  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      Number.parseInt(String(query.pageSize ?? DEFAULT_PAGE_SIZE), 10)
    )
  )

  return { page, pageSize }
}

function buildSearchClause(
  search: string
): UserWhereInput | undefined {
  if (!search) return undefined

  return {
    OR: [
      {
        name: {
          contains: search,
        },
      },
      {
        email: {
          contains: search,
        },
      },
    ],
  }
}

function buildRoleClause(
  role: typeof ALL_ROLES
): UserWhereInput | undefined {
  if (!role || role === ALL_ROLES) {
    return undefined
  }

  return {
    roles: {
      some: {
        role,
        active: true,
      },
    },
  }
}

function countUsersByRole(
  searchClause: UserWhereInput | undefined,
  role: typeof ALL_ROLES    
) {
  return prisma.user.count({
    where: {
      AND: [
        searchClause,
        buildRoleClause(role),
      ].filter(removeUndefined),
    },
  })
}

function calculateApprovedHours(
  hourLogs: { hours: number }[] = []
) {
  return hourLogs.reduce(
    (sum, log) => sum + log.hours,
    0
  )
}

function toUserSummary(user: {
  id: string
  name: string | null
  email: string
  imageURL: string | null
  roles: {
    role: string
    active: boolean
  }[]
  volunteer: {
    hourLogs: {
      hours: number
    }[]
  } | null
}) {
  return {
    id: user.id,
    name: user.name ?? 'Unnamed User',
    email: user.email,
    roles: user.roles
      .filter((r) => r.active)
      .map((r) => r.role),
    hours: calculateApprovedHours(
      user.volunteer?.hourLogs ?? []
    ),
    avatarUrl: user.imageURL,
  }
}

// ---- Handler ----

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const search = String(query.search ?? '').trim()
  const role = String(query.role ?? ALL_ROLES)

  const { page, pageSize } = parsePagination(query)

  const searchClause = buildSearchClause(search)
  const roleClause = buildRoleClause(role as any)

  const where: UserWhereInput = {
    AND: [
      searchClause,
      roleClause,
    ].filter(removeUndefined),
  }

  const [total, roleCounts, users, allCount] =
    await Promise.all([
      prisma.user.count({
        where,
      }),

      Promise.all(
        COUNTABLE_ROLES.map((role) =>
          countUsersByRole(searchClause, role as any)
        )
      ),

      prisma.user.findMany({
        where,

        include: {
          roles: true,

          volunteer: {
            include: {
              hourLogs: {
                where: {
                  approvalStatus: 'APPROVED',
                },
              },
            },
          },
        },

        orderBy: {
          name: 'asc',
        },

        skip: (page - 1) * pageSize,
        take: pageSize,
      }),

      prisma.user.count({
        where: {
          AND: [searchClause].filter(removeUndefined),
        },
      }),
    ])

  const counts = {
    all: allCount,

    ...Object.fromEntries(
      COUNTABLE_ROLES.map((role, index) => [
        role.toLowerCase(),
        roleCounts[index],
      ])
    ),
  }

  return {
    users: users.map(toUserSummary),

    total,

    page,

    pageSize,

    totalPages: Math.max(
      1,
      Math.ceil(total / pageSize)
    ),

    counts,
  }
})