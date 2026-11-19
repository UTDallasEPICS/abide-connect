import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '#server/utils/prisma'
import { at, createEvent, resetDatabase } from '../setup/fixtures'
import { createFakeEvent } from '../setup/h3-globals'

/**
 * The event importer's write path, against the real schema.
 *
 * The mapping is covered by `tests/unit/eventImport.test.ts`; what is left here
 * is what can only go wrong against a database — that a preview writes nothing,
 * that re-running a file adds nothing, that an event already in the app is left
 * alone, and that one bad address doesn't sink the rest of the file.
 *
 * Geocoding is stubbed: the real one is a network call to a rate-limited public
 * service. The stub knows one address and fails every other, which is exactly
 * the split the importer has to handle.
 */
vi.mock('#server/utils/requireRole', () => ({
  requireRole: vi.fn(async () => ({ user: { id: 'admin-user' }, session: {} })),
}))

const geocodeLocation = vi.fn(async (address: string) =>
  address.includes('Nowhere') ? null : { address, latitude: 32.78, longitude: -96.8 },
)
vi.mock('#server/utils/geocode', () => ({
  GEOCODE_INTERVAL_MS: 0,
  geocodeLocation: (address: string) => geocodeLocation(address),
}))

const { default: ingest } = await import('#server/api/admin/ingest/events.post')

const HEADERS = 'Name,Date,Start Time,End Time,Location,Type'
const DRIVE = 'Diaper Drive,2026-03-14,9:00 AM,1:00 PM,"123 Main St, Dallas, TX",Public'
const SHIFT = 'Clinic Shift,2026-03-16,8:00 AM,12:00 PM,"123 Main St, Dallas, TX",Volunteers only'
const NO_PLACE = 'Info Night,2026-03-20,6:00 PM,7:00 PM,,'
const BAD_PLACE = 'Pop-up,2026-03-21,9:00 AM,10:00 AM,Nowhere Rd,Public'

const csv = (...rows: string[]) => [HEADERS, ...rows].join('\n')

interface Result {
  mode: string
  totalRows: number
  summary: Record<string, number>
  events: { title: string, action: string, location: string | null, eventType: string, error?: string }[]
}

const run = (text: string, commit: boolean, defaults: Record<string, string> = {}) =>
  (ingest as (e: ReturnType<typeof createFakeEvent>) => Promise<Result>)(
    createFakeEvent({ body: { csv: text, commit, ...defaults } }),
  )

beforeEach(async () => {
  await resetDatabase()
  geocodeLocation.mockClear()
})

afterAll(async () => {
  await resetDatabase()
})

describe('preview', () => {
  it('writes nothing and looks nothing up', async () => {
    const result = await run(csv(DRIVE, SHIFT), false)

    expect(result.mode).toBe('preview')
    expect(result.summary.create).toBe(2)
    // Two rows, one address between them.
    expect(result.summary.newLocations).toBe(1)
    expect(await prisma.event.count()).toBe(0)
    expect(await prisma.location.count()).toBe(0)
    expect(geocodeLocation).not.toHaveBeenCalled()
  })
})

describe('commit', () => {
  it('creates the events with their audience and a shared location', async () => {
    await run(csv(DRIVE, SHIFT), true)

    const events = await prisma.event.findMany({ orderBy: { startTime: 'asc' }, include: { location: true } })
    expect(events.map(e => e.title)).toEqual(['Diaper Drive', 'Clinic Shift'])

    const [drive, shift] = events
    // 9:00 AM CDT on 14 March 2026 is 14:00Z; 1:00 PM is 18:00Z.
    expect(drive!.startTime.toISOString()).toBe('2026-03-14T14:00:00.000Z')
    expect(drive!.endTime.toISOString()).toBe('2026-03-14T18:00:00.000Z')
    expect(drive!.location.address).toBe('123 Main St, Dallas, TX')
    expect([drive!.allowVolunteers, drive!.allowAttendees, drive!.isTraining]).toEqual([false, true, false])
    expect([shift!.allowVolunteers, shift!.allowAttendees, shift!.isTraining]).toEqual([true, false, false])
    // Not mirrored to the shared calendar — see the handler's header.
    expect(drive!.calendarEventId).toBeNull()

    // One address, geocoded once and reused by the second row.
    expect(await prisma.location.count()).toBe(1)
    expect(geocodeLocation).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when the same file is run again', async () => {
    await run(csv(DRIVE, SHIFT), true)
    const again = await run(csv(DRIVE, SHIFT), true)

    expect(again.summary.create).toBe(0)
    expect(again.summary.alreadyImported).toBe(2)
    expect(await prisma.event.count()).toBe(2)
  })

  it('leaves an event that already exists in the app untouched', async () => {
    const existing = await createEvent({
      title: 'Diaper Drive',
      startTime: at(2026, 3, 14, 9),
      endTime: at(2026, 3, 14, 11),
    })

    const result = await run(csv(DRIVE), true)

    expect(result.events[0]!.action).toBe('ALREADY_IMPORTED')
    expect(await prisma.event.count()).toBe(1)
    const after = await prisma.event.findUniqueOrThrow({ where: { id: existing.id } })
    // The app's 11am end stands; the board's 1pm does not overwrite it.
    expect(after.endTime.toISOString()).toBe('2026-03-14T16:00:00.000Z')
  })

  it('skips a row with no address unless a default location is given', async () => {
    const skipped = await run(csv(NO_PLACE), true)
    expect(skipped.events[0]!.action).toBe('NEEDS_LOCATION')
    expect(await prisma.event.count()).toBe(0)

    const filled = await run(csv(NO_PLACE), true, {
      defaultLocation: '500 Clinic Way, Dallas, TX',
      defaultEventType: 'VOLUNTEERS',
    })
    expect(filled.events[0]!.action).toBe('CREATE')

    const event = await prisma.event.findFirstOrThrow({ include: { location: true } })
    expect(event.location.address).toBe('500 Clinic Way, Dallas, TX')
    // The row named no audience, so the default the admin picked applies.
    expect([event.allowVolunteers, event.allowAttendees]).toEqual([true, false])
  })

  it('reports an address it cannot place and still imports the rest', async () => {
    const result = await run(csv(BAD_PLACE, DRIVE), true)

    expect(result.summary.failed).toBe(1)
    expect(result.events.find(e => e.title === 'Pop-up')!.error).toContain('Nowhere Rd')
    expect((await prisma.event.findMany()).map(e => e.title)).toEqual(['Diaper Drive'])
  })
})

describe('validation', () => {
  it('rejects a file with no recognisable header', async () => {
    await expect(run('Owner,Status\nDana,Done', false)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects an empty upload', async () => {
    await expect(run('   ', false)).rejects.toMatchObject({ statusCode: 400 })
  })
})
