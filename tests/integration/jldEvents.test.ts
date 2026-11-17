import { randomUUID } from 'node:crypto'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '#server/utils/prisma'
import { eventTypeToFlags } from '#shared/utils/eventType'
import { at, createEvent, createVolunteer, resetDatabase } from '../setup/fixtures'
import { createFakeEvent } from '../setup/h3-globals'

/**
 * JLD events through the real read and sign-up endpoints.
 *
 * `tests/unit/eventType.test.ts` covers the rule itself. What can still go
 * wrong is the plumbing around it: a handler that selects the audience columns
 * by hand and forgets `isJld` reads a JLD event as an ordinary volunteer one
 * and hands it to every approved volunteer, and the paginated list filters in
 * SQL rather than through `canViewEvent` at all. So each endpoint is asked as
 * each kind of viewer, against a database holding one event of either kind.
 *
 * Only the session is faked. `getEventViewer` runs for real, so the viewer is
 * resolved from actual `Volunteer` and `User_Role` rows.
 */
let currentUserId: string | null = null

const session = () => currentUserId
  ? { session: { token: 'test', createdAt: new Date() }, user: { id: currentUserId } }
  : null

vi.mock('#server/utils/auth', () => ({
  auth: { api: { getSession: vi.fn(async () => session()) } },
}))
// The block sign-up route asks for the VOLUNTEER role; every signed-in viewer
// in this file is a volunteer, so the role itself isn't what's under test.
vi.mock('#server/utils/requireRole', () => ({
  requireRole: vi.fn(async () => {
    const current = session()
    if (!current) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
    return current
  }),
}))

const { default: allEvents } = await import('#server/api/events/index.get')
const { default: listEvents } = await import('#server/api/events/list.get')
const { default: oneEvent } = await import('#server/api/events/[id]/index.get')
const { default: eventSlots } = await import('#server/api/events/[id]/time-slots/index.get')
const { default: claimSlot } = await import('#server/api/events/[id]/time-slots/[slotId]/signup.post')

type Handler<T> = (event: ReturnType<typeof createFakeEvent>) => Promise<T>
const call = <T>(handler: unknown, options: Parameters<typeof createFakeEvent>[0] = {}) =>
  (handler as Handler<T>)(createFakeEvent(options))

/** Far enough out that "upcoming" holds whenever the suite runs. */
const START = at(2099, 6, 1, 9)
const END = at(2099, 6, 1, 17)

let jldEventId: string
let jldSlotId: string
let regularEventId: string

let approved: Awaited<ReturnType<typeof createVolunteer>>
let jld: Awaited<ReturnType<typeof createVolunteer>>
let pendingWithMark: Awaited<ReturnType<typeof createVolunteer>>
let adminUserId: string

beforeEach(async () => {
  await resetDatabase()
  currentUserId = null

  approved = await createVolunteer({ name: 'Approved Ana' })
  jld = await createVolunteer({ name: 'JLD Jo', isJld: true })
  pendingWithMark = await createVolunteer({ name: 'Pending Pat', approvalStatus: 'PENDING', isJld: true })

  const admin = await prisma.user.create({
    data: { id: randomUUID(), name: 'Admin Al', email: 'admin@example.test' },
  })
  await prisma.user_Role.create({ data: { userId: admin.id, role: 'ADMIN', active: true } })
  adminUserId = admin.id

  const jldEvent = await createEvent({
    title: 'JLD Night',
    startTime: START,
    endTime: END,
    flags: eventTypeToFlags('JLD'),
    slots: [{ startTime: START, endTime: END, capacity: 5 }],
  })
  jldEventId = jldEvent.id
  jldSlotId = (await prisma.event_Time_Slot.findFirstOrThrow({ where: { eventId: jldEvent.id } })).id

  regularEventId = (await createEvent({ title: 'Clinic Shift', startTime: START, endTime: END })).id
})

afterAll(async () => {
  await resetDatabase()
})

const as = (userId: string | null | undefined) => {
  currentUserId = userId ?? null
}

const titlesFromAll = async () =>
  (await call<{ title: string }[]>(allEvents)).map(e => e.title).sort()

const listed = () =>
  call<{ events: { title: string }[], total: number, counts: { all: number } }>(listEvents)

describe('GET /api/events', () => {
  it('includes the JLD event for a JLD volunteer and for staff', async () => {
    as(jld.userId)
    expect(await titlesFromAll()).toEqual(['Clinic Shift', 'JLD Night'])

    as(adminUserId)
    expect(await titlesFromAll()).toEqual(['Clinic Shift', 'JLD Night'])
  })

  it('leaves it out for an approved volunteer who is not JLD', async () => {
    as(approved.userId)
    expect(await titlesFromAll()).toEqual(['Clinic Shift'])
  })

  it('leaves it out for a marked volunteer who is not yet approved, and for the public', async () => {
    as(pendingWithMark.userId)
    expect(await titlesFromAll()).toEqual([])

    as(null)
    expect(await titlesFromAll()).toEqual([])
  })
})

describe('GET /api/events/list', () => {
  it('lists and counts the JLD event for a JLD volunteer and for staff', async () => {
    as(jld.userId)
    const forJld = await listed()
    expect(forJld.events.map(e => e.title).sort()).toEqual(['Clinic Shift', 'JLD Night'])
    expect(forJld.total).toBe(2)
    expect(forJld.counts.all).toBe(2)

    as(adminUserId)
    expect((await listed()).total).toBe(2)
  })

  it('neither lists nor counts it for anyone else', async () => {
    for (const userId of [approved.userId, pendingWithMark.userId, null]) {
      as(userId)
      const result = await listed()
      expect(result.events.map(e => e.title)).toEqual(['Clinic Shift'])
      // The totals label the filter buttons — a hidden event must not show up
      // there as an unexplained extra one.
      expect(result.total).toBe(1)
      expect(result.counts.all).toBe(1)
    }
  })
})

describe('GET /api/events/:id', () => {
  it('returns the JLD event to a JLD volunteer', async () => {
    as(jld.userId)
    const event = await call<{ title: string }>(oneEvent, { params: { id: jldEventId } })
    expect(event.title).toBe('JLD Night')
  })

  it('404s for an approved volunteer who is not JLD, as if it did not exist', async () => {
    as(approved.userId)
    await expect(call(oneEvent, { params: { id: jldEventId } })).rejects.toMatchObject({ statusCode: 404 })
    // The ordinary volunteer event is still theirs to see.
    await expect(call(oneEvent, { params: { id: regularEventId } })).resolves.toMatchObject({ title: 'Clinic Shift' })
  })
})

describe('time blocks on a JLD event', () => {
  it('are hidden from an approved volunteer who is not JLD', async () => {
    as(approved.userId)
    await expect(call(eventSlots, { params: { id: jldEventId } })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('cannot be claimed by one, even with the block id in hand', async () => {
    as(approved.userId)
    await expect(
      call(claimSlot, { params: { id: jldEventId, slotId: jldSlotId } }),
    ).rejects.toMatchObject({ statusCode: 404 })
    expect(await prisma.event_Time_Slot_Signup.count()).toBe(0)
  })

  it('can be claimed by a JLD volunteer', async () => {
    as(jld.userId)
    await call(claimSlot, { params: { id: jldEventId, slotId: jldSlotId } })

    const signups = await prisma.event_Time_Slot_Signup.findMany()
    expect(signups.map(s => [s.volunteerId, s.status])).toEqual([[jld.id, 'CONFIRMED']])
  })
})
