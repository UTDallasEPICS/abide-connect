import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '#server/utils/prisma'
import { at, createFakeEvent, createHourLog, createVolunteer, resetDatabase } from '../setup/fixtures'

/**
 * The write side of the reporting feature.
 *
 * `/admin/reports` can only be as accurate as what the review endpoints record,
 * and this branch added two fields for them to record: `program`, which drives
 * the funder report's hours-by-program breakdown, and `approvedAt`, which is the
 * only thing that makes the approval-latency median mean "how long did the
 * volunteer wait" rather than "when did somebody last touch the row".
 *
 * The rule under test is the same on both review paths: stamped once, on the
 * first decision, and cleared if the log goes back to PENDING.
 */
vi.mock('#server/utils/requireRole', () => ({
  requireRole: vi.fn(async () => ({ user: { id: 'admin-user' }, session: {} })),
}))

// `hour-log/[id].patch.ts` and `create.post.ts` reach `prisma` through Nitro's
// auto-import rather than an explicit one, so the global has to exist here.
vi.stubGlobal('prisma', prisma)

const { default: reviewPatch } = await import('#server/api/volunteer-logs/[id].patch')
const { default: adminPatch } = await import('#server/api/hour-log/[id].patch')
const { default: createLog } = await import('#server/api/hour-log/create.post')

const SUBMITTED = new Date('2026-06-01T15:00:00Z')
const DECIDED = new Date('2026-06-04T15:00:00Z')
const LATER = new Date('2026-06-20T15:00:00Z')

let volunteerId: string
let userId: string

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  await resetDatabase()

  const volunteer = await createVolunteer({ name: 'Alice Alvarez', email: 'alice@example.test' })
  volunteerId = volunteer.id
  userId = volunteer.userId!
})

beforeEach(async () => {
  vi.setSystemTime(DECIDED)
  await prisma.volunteer_Hour_Log.deleteMany()
})

afterAll(async () => {
  vi.useRealTimers()
  await resetDatabase()
})

/** A freshly submitted, undecided log. */
async function pendingLog(hours = 4) {
  return createHourLog({
    volunteerId,
    date: at(2026, 6, 1),
    hours,
    status: 'PENDING',
    createdAt: SUBMITTED,
    approvedAt: null,
  })
}

const review = (id: number, body: Record<string, unknown>) =>
  (reviewPatch as (e: ReturnType<typeof createFakeEvent>) => Promise<unknown>)(
    createFakeEvent({ params: { id: String(id) }, body }),
  )

const edit = (id: number, body: Record<string, unknown>) =>
  (adminPatch as (e: ReturnType<typeof createFakeEvent>) => Promise<unknown>)(
    createFakeEvent({ params: { id: String(id) }, body }),
  )

const reload = (id: number) => prisma.volunteer_Hour_Log.findUniqueOrThrow({ where: { id } })

describe('the review queue stamps the decision time', () => {
  it('records when a pending log was first approved', async () => {
    const log = await pendingLog()
    await review(log.id, { status: 'APPROVED' })

    const updated = await reload(log.id)
    expect(updated.approvalStatus).toBe('APPROVED')
    expect(updated.approvedAt?.toISOString()).toBe(DECIDED.toISOString())
    // Three days from submission to decision — what the latency median reads.
    expect(updated.approvedAt!.getTime() - updated.createdAt.getTime()).toBe(3 * 86_400_000)
  })

  it('records a rejection as a decision too', async () => {
    const log = await pendingLog()
    await review(log.id, { status: 'REJECTED' })
    expect((await reload(log.id)).approvedAt?.toISOString()).toBe(DECIDED.toISOString())
  })

  it('keeps the first decision time when the verdict is changed later', async () => {
    // The volunteer got their answer on the 4th; a reviewer changing their mind
    // on the 20th does not make them wait longer in retrospect.
    const log = await pendingLog()
    await review(log.id, { status: 'APPROVED' })

    vi.setSystemTime(LATER)
    await review(log.id, { status: 'REJECTED' })

    const updated = await reload(log.id)
    expect(updated.approvalStatus).toBe('REJECTED')
    expect(updated.approvedAt?.toISOString()).toBe(DECIDED.toISOString())
  })

  it('clears the stamp when a log is sent back to pending', async () => {
    const log = await pendingLog()
    await review(log.id, { status: 'APPROVED' })
    await review(log.id, { status: 'PENDING' })

    const updated = await reload(log.id)
    expect(updated.approvalStatus).toBe('PENDING')
    expect(updated.approvedAt).toBeNull()
  })

  it('re-stamps from scratch once a reopened log is decided again', async () => {
    // The clock restarts: the log is genuinely waiting a second time.
    const log = await pendingLog()
    await review(log.id, { status: 'APPROVED' })
    await review(log.id, { status: 'PENDING' })

    vi.setSystemTime(LATER)
    await review(log.id, { status: 'APPROVED' })
    expect((await reload(log.id)).approvedAt?.toISOString()).toBe(LATER.toISOString())
  })

  it('overwrites the reviewer comment, clearing it when omitted', async () => {
    const log = await pendingLog()
    await review(log.id, { status: 'APPROVED', comment: 'Confirmed with the coordinator' })
    expect((await reload(log.id)).comment).toBe('Confirmed with the coordinator')

    await review(log.id, { status: 'APPROVED' })
    expect((await reload(log.id)).comment).toBeNull()
  })
})

describe('the admin edit path', () => {
  it('accepts a humanised status and stamps the decision', async () => {
    // The edit form round-trips the display value from `user/[id].get.ts`.
    const log = await pendingLog()
    await edit(log.id, { approvalStatus: 'Approved' })

    const updated = await reload(log.id)
    expect(updated.approvalStatus).toBe('APPROVED')
    expect(updated.approvedAt?.toISOString()).toBe(DECIDED.toISOString())
  })

  it('leaves the decision time alone when the status is not part of the edit', async () => {
    // Fixing a typo in a comment must not move the approval-latency clock —
    // that is exactly the reason `approvedAt` exists rather than `updatedAt`.
    const log = await pendingLog()
    await edit(log.id, { approvalStatus: 'Approved' })

    vi.setSystemTime(LATER)
    await edit(log.id, { comment: 'Corrected the event name' })

    const updated = await reload(log.id)
    expect(updated.approvedAt?.toISOString()).toBe(DECIDED.toISOString())
    expect(updated.comment).toBe('Corrected the event name')
    // `updatedAt` does move, which is why the report cannot use it.
    expect(updated.updatedAt.getTime()).toBeGreaterThan(updated.approvedAt!.getTime())
  })

  it('reopening through this path clears the stamp as well', async () => {
    const log = await pendingLog()
    await edit(log.id, { approvalStatus: 'Approved' })
    await edit(log.id, { approvalStatus: 'Pending' })
    expect((await reload(log.id)).approvedAt).toBeNull()
  })

  it('sets the program, turning an inferred attribution into a stated one', async () => {
    const log = await pendingLog()
    expect(log.program).toBeNull()

    await edit(log.id, { program: 'MOBILE_CLINIC_OUTREACH' })
    expect((await reload(log.id)).program).toBe('MOBILE_CLINIC_OUTREACH')
  })

  it('clears the program back to inferred when sent an empty value', async () => {
    const log = await pendingLog()
    await edit(log.id, { program: 'CLINIC_SUPPORT' })
    await edit(log.id, { program: '' })
    expect((await reload(log.id)).program).toBeNull()

    await edit(log.id, { program: 'CLINIC_SUPPORT' })
    await edit(log.id, { program: null })
    expect((await reload(log.id)).program).toBeNull()
  })

  it('is a true partial update — an omitted field is left alone', async () => {
    const log = await pendingLog(4)
    await edit(log.id, { program: 'EVENT_SUPPORT', comment: 'Original note' })
    await edit(log.id, { hours: 6 })

    const updated = await reload(log.id)
    expect(updated.hours).toBe(6)
    expect(updated.program).toBe('EVENT_SUPPORT')
    expect(updated.comment).toBe('Original note')
    expect(updated.approvalStatus).toBe('PENDING')
  })

  it('rejects a request with no log id', async () => {
    await expect(
      (adminPatch as (e: ReturnType<typeof createFakeEvent>) => Promise<unknown>)(
        createFakeEvent({ body: { hours: 1 } }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('logging hours on a volunteer\'s behalf', () => {
  const create = (body: Record<string, unknown>) =>
    (createLog as (e: ReturnType<typeof createFakeEvent>) => Promise<{ id: number }>)(
      createFakeEvent({ body }),
    )

  it('stores an optional program alongside the hours', async () => {
    const created = await create({
      userId, date: '2026-06-10', hours: 3, program: 'COMMUNITY_OUTREACH',
    })
    const log = await reload(created.id)
    expect(log.program).toBe('COMMUNITY_OUTREACH')
    expect(log.volunteerId).toBe(volunteerId)
  })

  it('leaves the program null when none is given, so the report infers it', async () => {
    const created = await create({ userId, date: '2026-06-10', hours: 3 })
    expect((await reload(created.id)).program).toBeNull()
  })

  it('starts unapproved and undecided even though an admin created it', async () => {
    const created = await create({ userId, date: '2026-06-10', hours: 3 })
    const log = await reload(created.id)
    expect(log.approvalStatus).toBe('PENDING')
    // Nothing has been decided, so it must not enter the latency figures.
    expect(log.approvedAt).toBeNull()
  })

  it('validates the fields the reports depend on', async () => {
    await expect(create({ date: '2026-06-10', hours: 3 })).rejects.toMatchObject({ statusCode: 400 })
    await expect(create({ userId, hours: 3 })).rejects.toMatchObject({ statusCode: 400 })
    await expect(create({ userId, date: '2026-06-10', hours: 0 })).rejects.toMatchObject({ statusCode: 400 })
    await expect(create({ userId, date: '2026-06-10', hours: -2 })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('404s rather than creating an orphan log for a user who never volunteered', async () => {
    const plainUser = await prisma.user.create({
      data: { email: 'attendee@example.test', name: 'Attendee' },
    })
    await expect(create({ userId: plainUser.id, date: '2026-06-10', hours: 3 }))
      .rejects.toMatchObject({ statusCode: 404 })
  })
})
