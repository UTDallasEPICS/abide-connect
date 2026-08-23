import { z } from 'zod'
import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'

/**
 * Paginated, searchable event list backing the public Events page.
 *
 * `filter=ALL` returns events that haven't ended yet (upcoming/ongoing);
 * `filter=PAST` returns events whose endTime has already passed.
 *
 * Training events are excluded from results unless the caller is an admin,
 * or is a volunteer whose approvalStatus isn't APPROVED.
 *
 * `counts.all` is the total count of upcoming events regardless of the
 * current search term — it's meant to label the "ALL" filter button with a
 * stable number, not to reflect the currently filtered result set.
 *
 * Note: search is a plain `contains` (case-SENSITIVE) rather than
 * `mode: 'insensitive'` — that Prisma option is Postgres-only and isn't
 * supported on SQLite, which this app runs on (better-sqlite3).
 */
const querySchema = z.object({
  filter: z.enum(['ALL', 'PAST']).default('ALL'),
  search: z.string().optional().default(''),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
})

export default defineEventHandler(async (event) => {
  const { filter, search, page, pageSize } = await getValidatedQuery(event, querySchema.parse)

  const session = await auth.api.getSession({ headers: event.headers })
  event.context.session = session

  let canSeeTrainings = false
  if (session?.user) {
    const isAdmin = (session.user as { role?: string }).role === 'ADMIN'
    if (isAdmin) {
      canSeeTrainings = true
    }
    else {
      const volunteer = await prisma.volunteer.findUnique({
        where: { userId: session.user.id },
        select: { approvalStatus: true },
      })
      canSeeTrainings = !!volunteer && volunteer.approvalStatus !== 'APPROVED'
    }
  }

  const now = new Date()

  const trainingWhere = canSeeTrainings ? {} : { isTraining: false }
  const searchWhere = search ? { title: { contains: search } } : {}

  // Result set for whichever filter/search is currently active — this is
  // what actually gets paginated and returned as `events`.
  const activeWhere = {
    ...(filter === 'PAST' ? { endTime: { lt: now } } : { endTime: { gte: now } }),
    ...trainingWhere,
    ...searchWhere,
  }

  // Stable total for the "ALL" button label — upcoming events, unaffected
  // by the search box, so the number doesn't flicker as someone types.
  const allTotalWhere = {
    endTime: { gte: now },
    ...trainingWhere,
  }

  const [total, allTotal, events] = await Promise.all([
    prisma.event.count({ where: activeWhere }),
    prisma.event.count({ where: allTotalWhere }),
    prisma.event.findMany({
      where: activeWhere,
      orderBy: { startTime: filter === 'PAST' ? 'desc' : 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        location: true,
        eventAssets: true,
      },
    }),
  ])

  const results = events.map((e) => {
    const asset = e.eventAssets[0]
    const image = asset
      ? `/api/events/${e.id}/images/${asset.imageUrl.split('/').pop()}`
      : '/images/default-event.jpg'
    return {
      id: e.id,
      title: e.title,
      url: `/events/${e.id}`,
      image,
      startTime: e.startTime,
      location: e.location.address,
    }
  })

  return {
    events: results,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts: {
      all: allTotal,
    },
  }
})
