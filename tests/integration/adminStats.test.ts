import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { HoursReport } from '#shared/types/reports'
import { at, callHandler, createHourLog, createVolunteer, resetDatabase } from '../setup/fixtures'

/**
 * The dashboard KPI tiles on `/admin`, which this branch extended with
 * year-to-date and quarter-to-date approved hours.
 *
 * The tiles and `/admin/reports` are two different queries over the same table,
 * shown a click apart, so the test that matters most is that they agree: a
 * coordinator who sees 25 hours on the dashboard and 24 on the report has no
 * way to tell which one to trust.
 */
vi.mock('#server/utils/requireRole', () => ({
  requireRole: vi.fn(async () => ({ user: { id: 'admin-user' }, session: {} })),
}))

const { default: statsHandler } = await import('#server/api/admin/stats.get')
const { default: hoursHandler } = await import('#server/api/admin/reports/hours.get')

/** Monday 17 August 2026, 2:00 PM Central — Q3, so QTD starts 1 July. */
const NOW = new Date('2026-08-17T19:00:00Z')

interface Stats {
  totalUsers: number
  activeVolunteers: number
  pendingCertificates: number
  pendingTimeLogs: number
  hoursYearToDate: number
  hoursQuarterToDate: number
}

/**
 * Every log sits deliberately close to a boundary, at an hour of the Central
 * evening that reads as the following day in UTC — which is the clock the
 * server actually runs on.
 */
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)

  await resetDatabase()

  const alice = await createVolunteer({ name: 'Alice Alvarez', email: 'alice@example.test' })
  const bob = await createVolunteer({ name: 'Bob Brennan', email: 'bob@example.test', approvalStatus: 'PENDING' })

  await createHourLog({ volunteerId: alice.id, date: at(2025, 12, 31, 23), hours: 5 })
  await createHourLog({ volunteerId: alice.id, date: at(2026, 1, 1, 0), hours: 7 })
  await createHourLog({ volunteerId: alice.id, date: at(2026, 6, 30, 23), hours: 3 })
  await createHourLog({ volunteerId: alice.id, date: at(2026, 7, 1, 0), hours: 11 })
  // Logged later today: the range runs to tomorrow's midnight, so it counts.
  await createHourLog({ volunteerId: alice.id, date: at(2026, 8, 17, 20), hours: 4 })

  await createHourLog({ volunteerId: bob.id, date: at(2026, 8, 1), hours: 100, status: 'PENDING' })
  await createHourLog({ volunteerId: bob.id, date: at(2026, 8, 2), hours: 50, status: 'REJECTED' })
})

afterAll(async () => {
  vi.useRealTimers()
  await resetDatabase()
})

const stats = () => callHandler(statsHandler as never) as Promise<Stats>

describe('hours tiles', () => {
  it('sums approved hours since 1 January, in Central time', async () => {
    // 7 (Jan 1) + 3 (Jun 30) + 11 (Jul 1) + 4 (today) = 25. The 5 hours logged
    // at 11pm on 31 Dec are last year's, though UTC would call them Jan 1.
    expect((await stats()).hoursYearToDate).toBe(25)
  })

  it('sums approved hours since the quarter began', async () => {
    // Q3 starts 1 July: 11 + 4 = 15. The 3 hours at 11pm on 30 June are Q2's.
    expect((await stats()).hoursQuarterToDate).toBe(15)
  })

  it('counts approved hours only, so the tile is not inflated by the queue', async () => {
    const { hoursYearToDate } = await stats()
    // The pending 100h and rejected 50h are both dated inside the year.
    expect(hoursYearToDate).toBe(25)
    expect(hoursYearToDate).toBeLessThan(100)
  })

  it('agrees with /admin/reports at the same preset', async () => {
    // The tile and the report are separate queries over the same rows; if they
    // ever disagree, one of them is lying to a coordinator.
    const tiles = await stats()

    const ytd = await callHandler(hoursHandler as never, { query: { preset: 'YTD' } }) as HoursReport
    expect(ytd.summary.approvedHours).toBe(tiles.hoursYearToDate)

    const qtd = await callHandler(hoursHandler as never, { query: { preset: 'QTD' } }) as HoursReport
    expect(qtd.summary.approvedHours).toBe(tiles.hoursQuarterToDate)
  })
})

describe('the other tiles still report correctly', () => {
  it('counts everyone the org serves, excluding staff', async () => {
    expect((await stats()).totalUsers).toBe(2)
  })

  it('counts approved volunteers, not applicants', async () => {
    // Bob has applied but has not been cleared.
    expect((await stats()).activeVolunteers).toBe(1)
  })

  it('counts the hour logs waiting on a decision', async () => {
    expect((await stats()).pendingTimeLogs).toBe(1)
  })
})

describe('an empty install', () => {
  it('returns zeroes across the board rather than nulls', async () => {
    await resetDatabase()
    expect(await stats()).toEqual({
      totalUsers: 0,
      activeVolunteers: 0,
      pendingCertificates: 0,
      pendingTimeLogs: 0,
      hoursYearToDate: 0,
      hoursQuarterToDate: 0,
    })
  })
})
