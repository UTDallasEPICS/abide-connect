import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { HoursReport } from '#shared/types/reports'
import { at, callHandler, createEvent, createHourLog, createVolunteer, resetDatabase } from '../setup/fixtures'

/**
 * End-to-end checks on `/api/admin/reports/hours` — the operational report.
 *
 * The handler runs for real against a real SQLite database built from the real
 * migrations. Only the session check is stubbed, so every `where` clause, every
 * `groupBy` and every aggregation on the page is exercised.
 *
 * Every expected number below is hand-computed from the fixture and written as
 * a literal, with the arithmetic in a comment. That is the point of the file:
 * if it merely recomputed the totals the same way the handler does, a wrong
 * definition would agree with itself and the suite would pass.
 */
vi.mock('#server/utils/requireRole', () => ({
  requireRole: vi.fn(async () => ({ user: { id: 'admin-user' }, session: {} })),
}))

const { default: handler } = await import('#server/api/admin/reports/hours.get')

/** Monday 17 August 2026, 2:00 PM Central. Pinned so "days since" is stable. */
const NOW = new Date('2026-08-17T19:00:00Z')

/** The range under test: 1 Jan – 30 Jun 2026, bucketed by month. */
const RANGE = { preset: 'CUSTOM', from: '2026-01-01', to: '2026-06-30', granularity: 'month' }

const volunteers: Record<string, string> = {}

/**
 * The fixture, in full.
 *
 * ┌────────┬──────────────┬────────────────────────────────────────────────┐
 * │ Alice  │ Clinic only  │ Jan 15 4h · Feb 20 6h · Mar 10 5h · May 5 7h⏳ │
 * │ Bob    │ two areas    │ Feb 5 8h · Apr 12 12h · May 6 9h✗ · Jun 20 2h⏳│
 * │ Cara   │ no areas     │ Jan 20 30h · Jun 1 25h · Jul 15 100h (outside) │
 * │ Dan    │ roster PENDING│ Mar 1 3h                                      │
 * │ Eve    │ lapsed       │ Nov 1 2025 10h                                 │
 * │ Frank  │ no account   │ May 20 4h                                      │
 * └────────┴──────────────┴────────────────────────────────────────────────┘
 * ⏳ pending · ✗ rejected. Alice also has a Mar 2025 log, for the prior period.
 */
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)

  await resetDatabase()

  const alice = await createVolunteer({
    name: 'Alice Alvarez',
    email: 'alice@example.test',
    areas: ['CLINIC_SUPPORT'],
    signedUpAt: at(2026, 2, 10),
  })
  const bob = await createVolunteer({
    name: 'Bob Brennan',
    email: 'bob@example.test',
    areas: ['EVENT_SUPPORT', 'COMMUNITY_OUTREACH'],
    signedUpAt: at(2026, 3, 5),
  })
  const cara = await createVolunteer({
    name: 'Cara Chen',
    email: 'cara@example.test',
    signedUpAt: at(2024, 6, 1),
  })
  const dan = await createVolunteer({
    name: 'Dan Doyle',
    email: 'dan@example.test',
    approvalStatus: 'PENDING',
    signedUpAt: at(2026, 4, 1),
  })
  const eve = await createVolunteer({
    name: 'Eve Espinoza',
    email: 'eve@example.test',
    signedUpAt: at(2025, 1, 1),
  })
  const frank = await createVolunteer({ withoutAccount: true })

  Object.assign(volunteers, {
    alice: alice.id, bob: bob.id, cara: cara.id, dan: dan.id, eve: eve.id, frank: frank.id,
  })

  const mobileClinic = await createEvent({
    title: 'Mobile clinic day',
    startTime: at(2026, 4, 12, 9),
    endTime: at(2026, 4, 12, 15),
  })

  // In-range approved hours. `approvedAt` is set a fixed number of days after
  // `createdAt` so the latency median has a known answer.
  await createHourLog({ volunteerId: alice.id, date: at(2026, 1, 15), hours: 4, program: 'CLINIC_SUPPORT', createdAt: at(2026, 1, 15), approvedAt: at(2026, 1, 17) })
  await createHourLog({ volunteerId: alice.id, date: at(2026, 2, 20), hours: 6, createdAt: at(2026, 2, 20), approvedAt: at(2026, 2, 24) })
  await createHourLog({ volunteerId: alice.id, date: at(2026, 3, 10), hours: 5, createdAt: at(2026, 3, 10), approvedAt: at(2026, 3, 16) })
  // No `approvedAt`: a row decided before the column existed.
  await createHourLog({ volunteerId: bob.id, date: at(2026, 2, 5), hours: 8, program: 'EVENT_SUPPORT', createdAt: at(2026, 2, 5), approvedAt: null, updatedAt: at(2026, 2, 6) })
  await createHourLog({ volunteerId: bob.id, date: at(2026, 4, 12), hours: 12, eventId: mobileClinic.id, createdAt: at(2026, 4, 12), approvedAt: at(2026, 4, 22) })
  await createHourLog({ volunteerId: cara.id, date: at(2026, 1, 20), hours: 30, program: 'MOBILE_CLINIC_OUTREACH', createdAt: at(2026, 1, 20), approvedAt: at(2026, 1, 21) })
  await createHourLog({ volunteerId: cara.id, date: at(2026, 6, 1), hours: 25, createdAt: at(2026, 6, 1), approvedAt: at(2026, 6, 2) })
  await createHourLog({ volunteerId: dan.id, date: at(2026, 3, 1), hours: 3, createdAt: at(2026, 3, 1), approvedAt: at(2026, 3, 2) })
  await createHourLog({ volunteerId: frank.id, date: at(2026, 5, 20), hours: 4, createdAt: at(2026, 5, 20), approvedAt: at(2026, 5, 21) })

  // Not approved.
  await createHourLog({ volunteerId: alice.id, date: at(2026, 5, 5), hours: 7, status: 'PENDING', createdAt: at(2026, 5, 5), approvedAt: null })
  await createHourLog({ volunteerId: bob.id, date: at(2026, 6, 20), hours: 2, status: 'PENDING', createdAt: at(2026, 6, 20), approvedAt: null })
  await createHourLog({ volunteerId: bob.id, date: at(2026, 5, 6), hours: 9, status: 'REJECTED', createdAt: at(2026, 5, 6), approvedAt: at(2026, 5, 8) })

  // Outside the range, but inside the volunteers' lifetimes.
  await createHourLog({ volunteerId: cara.id, date: at(2026, 7, 15), hours: 100, createdAt: at(2026, 7, 15), approvedAt: at(2026, 7, 16) })
  await createHourLog({ volunteerId: alice.id, date: at(2025, 3, 1), hours: 40, createdAt: at(2025, 3, 1), approvedAt: at(2025, 3, 2) })
  await createHourLog({ volunteerId: eve.id, date: at(2025, 11, 1), hours: 10, eventName: 'Diaper drive', createdAt: at(2025, 11, 1), approvedAt: at(2025, 11, 2) })

  // Coverage: a Saturday with two blocks, and a Wednesday event with none.
  await createEvent({
    title: 'Clinic Saturday',
    startTime: at(2026, 3, 14, 8),
    endTime: at(2026, 3, 14, 21),
    slots: [
      { startTime: at(2026, 3, 14, 9), endTime: at(2026, 3, 14, 13), capacity: 4, signedUp: [alice.id, bob.id] },
      { startTime: at(2026, 3, 14, 18), endTime: at(2026, 3, 14, 20), capacity: 2, signedUp: [alice.id, cara.id] },
    ],
  })
  await createEvent({
    title: 'Community fair',
    startTime: at(2026, 4, 8, 13),
    endTime: at(2026, 4, 8, 16),
    volunteerRsvps: [alice.id, bob.id, cara.id],
  })
})

afterAll(async () => {
  vi.useRealTimers()
  await resetDatabase()
})

const report = (query: Record<string, string> = {}) =>
  callHandler(handler as never, { query: { ...RANGE, ...query } }) as Promise<HoursReport>

describe('range resolution', () => {
  it('echoes back the period it actually covered', async () => {
    const { range } = await report()
    expect(range).toMatchObject({
      preset: 'CUSTOM',
      from: '2026-01-01',
      to: '2026-06-30',
      label: 'Jan 1 – Jun 30, 2026',
      days: 181,
      granularity: 'month',
      status: 'approved',
      timeZone: 'America/Chicago',
    })
  })

  it('rejects an unparseable custom range instead of quietly reporting on another one', async () => {
    // A report whose header and numbers disagree is what gets pasted into a
    // grant application, so this has to be an error rather than a fallback.
    await expect(report({ from: 'last-tuesday', to: '2026-06-30' }))
      .rejects.toMatchObject({ statusCode: 400 })
    await expect(report({ from: '2026-06-30', to: '2026-01-01' }))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('falls back to year-to-date for an unknown preset', async () => {
    const { range } = await callHandler(handler as never, {
      query: { preset: 'LAST_TUESDAY' },
    }) as HoursReport
    expect(range.preset).toBe('YTD')
    expect(range.from).toBe('2026-01-01')
    expect(range.to).toBe('2026-08-17')
  })
})

describe('summary', () => {
  it('totals only the approved hours dated inside the range', async () => {
    const { summary } = await report()

    // Alice 4+6+5=15 · Bob 8+12=20 · Cara 30+25=55 · Dan 3 · Frank 4 → 97
    expect(summary.totalHours).toBe(97)
    expect(summary.approvedHours).toBe(97)
    expect(summary.pendingHours).toBe(0)
    expect(summary.totalEntries).toBe(9)
  })

  it('reports rejected hours separately rather than as zero', async () => {
    // Bob's 9h on May 6 is in no counted status, so it would otherwise vanish.
    expect((await report()).summary.rejectedHours).toBe(9)
  })

  it('counts a volunteer as active only if they logged inside the range', async () => {
    const { summary } = await report()
    // Alice, Bob, Cara, Dan, Frank. Eve's only hours predate the range.
    expect(summary.activeVolunteers).toBe(5)
    // Roster is approved volunteers on the books: everyone but Dan (PENDING).
    expect(summary.rosterVolunteers).toBe(5)
  })

  it('computes the central tendencies over volunteers, not over entries', async () => {
    const { summary } = await report()
    // Per-volunteer: [15, 20, 55, 3, 4]. Mean 97/5 = 19.4; median 15.
    expect(summary.meanHoursPerVolunteer).toBe(19.4)
    expect(summary.medianHoursPerVolunteer).toBe(15)
  })

  it('measures concentration against the busiest tenth', async () => {
    // 10% of 5 volunteers rounds up to 1: Cara's 55 of 97 hours = 56.7%.
    expect((await report()).summary.topDecileShare).toBe(56.7)
  })

  it('compares against the same span a year earlier', async () => {
    // Jan 1 – Jun 30 2025 contains only Alice's 40h in March.
    expect((await report()).summary.priorPeriodHours).toBe(40)
  })

  it('adds pending hours — and only pending — when asked for all statuses', async () => {
    const { summary } = await report({ status: 'all' })
    // Alice 7 (May 5) + Bob 2 (Jun 20).
    expect(summary.pendingHours).toBe(9)
    expect(summary.approvedHours).toBe(97)
    expect(summary.totalHours).toBe(106)
    // The rejected 9h stays out of the total at every status setting.
    expect(summary.rejectedHours).toBe(9)
    expect(summary.totalEntries).toBe(11)
  })
})

describe('time series', () => {
  it('emits one bucket per month, including the month nobody logged', async () => {
    const { series } = await report()
    expect(series.map(point => point.key)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
    ])
    expect(series.map(point => point.label)).toEqual([
      'Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26',
    ])
  })

  it('puts every hour in the month it was worked', async () => {
    const { series } = await report()
    expect(series.map(point => point.hours)).toEqual([
      34, // Alice 4 + Cara 30
      14, // Alice 6 + Bob 8
      8, //  Alice 5 + Dan 3
      12, // Bob
      4, //  Frank
      25, //  Cara
    ])
  })

  it('counts distinct volunteers per bucket, not entries', async () => {
    const { series } = await report()
    expect(series.map(point => point.volunteers)).toEqual([2, 2, 2, 1, 1, 1])
    expect(series.map(point => point.hoursPerVolunteer)).toEqual([17, 7, 4, 12, 4, 25])
  })

  it('sums the buckets back to the headline total', async () => {
    // The invariant that catches a row falling between two buckets.
    const { series, summary } = await report()
    const bucketed = series.reduce((total, point) => total + point.hours, 0)
    expect(bucketed).toBeCloseTo(summary.totalHours, 6)
  })

  it('re-buckets on request without changing the total', async () => {
    for (const granularity of ['day', 'week', 'month']) {
      const { series, summary } = await report({ granularity })
      const bucketed = series.reduce((total, point) => total + point.hours, 0)
      expect(bucketed, granularity).toBeCloseTo(summary.totalHours, 6)
    }
  })
})

describe('distribution', () => {
  it('bins volunteers by their total hours', async () => {
    const { distribution } = await report()
    const byLabel = Object.fromEntries(distribution.bins.map(bin => [bin.label, bin.volunteers]))
    // 3 and 4 in "0–5"; 15 in "10–20"; 20 in "20–40"; 55 in "40–80".
    expect(byLabel).toMatchObject({ '0–5': 2, '5–10': 0, '10–20': 1, '20–40': 1, '40–80': 1, '160+': 0 })
    expect(distribution.totalVolunteers).toBe(5)
  })

  it('accounts for every active volunteer exactly once', async () => {
    const { distribution, summary } = await report()
    const binned = distribution.bins.reduce((total, bin) => total + bin.volunteers, 0)
    expect(binned).toBe(summary.activeVolunteers)
  })

  it('names how few people carry half the hours', async () => {
    const { distribution } = await report()
    // 97 total, half is 48.5, and Cara's 55 clears it on her own.
    expect(distribution.volunteersForHalfOfHours).toBe(1)
    expect(distribution.max).toBe(55)
  })
})

describe('lapse risk', () => {
  it('lists previously active volunteers who have gone quiet, oldest first', async () => {
    const { lapseRisk, lapseThresholdDays } = await report()
    expect(lapseThresholdDays).toBe(60)
    expect(lapseRisk.map(entry => entry.name)).toEqual([
      'Eve Espinoza', // last logged Nov 1 2025
      'Alice Alvarez', // Mar 10 2026
      'Bob Brennan', // Apr 12 2026
      'Unnamed volunteer', // Frank, May 20 2026 — no account, so no name
    ])
  })

  it('measures the silence from the last hour logged to now', async () => {
    const { lapseRisk } = await report()
    expect(lapseRisk.map(entry => entry.daysSinceLastHour)).toEqual([289, 160, 127, 89])
    expect(lapseRisk.every(entry => entry.daysSinceLastHour >= 60)).toBe(true)
  })

  it('ignores the selected range, since lapsing is about lifetime activity', async () => {
    const { lapseRisk } = await report()
    const eve = lapseRisk.find(entry => entry.name === 'Eve Espinoza')!
    // Eve logged nothing inside Jan–Jun 2026 yet is the most urgent name here.
    expect(eve.lifetimeHours).toBe(10)
    expect(eve.recentHours).toBe(10)
    expect(eve.lastHourDate.slice(0, 10)).toBe('2025-11-01')
  })

  it('drops anyone whose recent activity falls outside the range', async () => {
    // Cara's most recent hours are in July — outside the report, but they are
    // exactly why she is not someone to chase.
    const { lapseRisk } = await report()
    expect(lapseRisk.map(entry => entry.name)).not.toContain('Cara Chen')
  })

  it('leaves out volunteers who were never approved', async () => {
    // Dan last logged in March but has never been cleared to volunteer, so he
    // belongs in the approvals queue, not on an outreach list.
    const { lapseRisk } = await report()
    expect(lapseRisk.map(entry => entry.name)).not.toContain('Dan Doyle')
  })

  it('names what each person was last doing', async () => {
    const { lapseRisk } = await report()
    const byName = Object.fromEntries(lapseRisk.map(entry => [entry.name, entry.lastActivity]))
    expect(byName['Bob Brennan']).toBe('Mobile clinic day') // from the linked event
    expect(byName['Eve Espinoza']).toBe('Diaper drive') // free-text, no event row
    expect(byName['Alice Alvarez']).toBe('Logged hours') // neither
  })

  it('reports lifetime totals, not range totals', async () => {
    const { lapseRisk } = await report()
    const alice = lapseRisk.find(entry => entry.name === 'Alice Alvarez')!
    // 15h in range plus 40h in March 2025 — and not the pending 7h.
    expect(alice.lifetimeHours).toBe(55)
    // "Recent" is the trailing 12 months from now, so the 2025 log is excluded.
    expect(alice.recentHours).toBe(15)
  })
})

describe('approval backlog', () => {
  it('describes the queue as it stands now, not as of the range', async () => {
    const { backlog } = await report()
    // Alice's 7h (May 5) and Bob's 2h (Jun 20) are the only pending rows.
    expect(backlog.pendingCount).toBe(2)
    expect(backlog.pendingHours).toBe(9)
    expect(backlog.oldestPendingDate!.slice(0, 10)).toBe('2026-05-05')
    expect(backlog.oldestPendingDays).toBe(104)
  })

  it('is unaffected by the status filter, which is about counted hours', async () => {
    const wide = await report({ status: 'all' })
    const narrow = await report()
    expect(wide.backlog).toEqual(narrow.backlog)
  })

  it('measures submission-to-decision, excluding rows it cannot measure', async () => {
    const { backlog } = await report()
    // Decided with updatedAt in range: Alice 2/4/6 days, Bob −/10, Cara 1/1,
    // Dan 1, Frank 1, and the rejected row at 2 — ten decisions, of which
    // Bob's February row carries no `approvedAt` and cannot be measured.
    expect(backlog.decidedCount).toBe(10)
    expect(backlog.unmeasuredCount).toBe(1)
    // Sorted: [1, 1, 1, 1, 2, 2, 4, 6, 10] → the middle value is 2.
    expect(backlog.medianDaysToDecision).toBe(2)
  })
})

describe('coverage', () => {
  const cell = (report: HoursReport, weekday: number, band: string) =>
    report.coverage.cells.find(c => c.weekday === weekday && c.band === band)!

  it('always returns the full grid so the heatmap keeps its shape', async () => {
    const { coverage } = await report()
    expect(coverage.cells).toHaveLength(28) // 7 weekdays × 4 bands
    expect(coverage.bands.map(band => band.id)).toEqual(['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'])
  })

  it('credits a shift to the Central day and band it starts in', async () => {
    const result = await report()
    // Sat 14 Mar, 9am–1pm, capacity 4, two signed up → 8 filled of 16 needed.
    expect(cell(result, 6, 'MORNING')).toMatchObject({
      filledHours: 8, neededHours: 16, fillRate: 0.5,
    })
    // Same day, 6–8pm, capacity 2, both taken → full.
    expect(cell(result, 6, 'EVENING')).toMatchObject({
      filledHours: 4, neededHours: 4, fillRate: 1,
    })
  })

  it('counts an event with no blocks as filled hours with no stated need', async () => {
    const result = await report()
    // Wed 8 Apr, 1–4pm, three volunteer RSVPs → 9 hours, need unknown.
    expect(cell(result, 3, 'AFTERNOON')).toMatchObject({
      filledHours: 9, neededHours: 0, fillRate: null,
    })
  })

  it('surfaces the worst-covered slot', async () => {
    const { coverage } = await report()
    expect(coverage.worstGap).toEqual({
      weekday: 6, band: 'MORNING', fillRate: 0.5, shortfallHours: 8,
    })
    expect(coverage.maxFilledHours).toBe(9)
    expect(coverage.needsAreUnknown).toBe(false)
  })

  it('says so when no event in the range had blocks drawn on it', async () => {
    // Without slots there is no capacity anywhere, and a grid of empty cells
    // would otherwise read as "nobody showed up".
    const { coverage } = await report({ from: '2026-06-01', to: '2026-06-30' })
    expect(coverage.needsAreUnknown).toBe(true)
    expect(coverage.worstGap).toBeNull()
  })
})

describe('new vs returning', () => {
  it('calls someone new only in the month they first ever logged hours', async () => {
    const { newVsReturning } = await report()
    const byKey = Object.fromEntries(newVsReturning.map(point => [point.key, point]))

    // Cara's first-ever log is Jan 2026, so January's 30h are new…
    expect(byKey['2026-01']).toMatchObject({ newHours: 30, returningHours: 4, newVolunteers: 1, returningVolunteers: 1 })
    // …while Alice, who started in March 2025, is returning throughout.
    expect(byKey['2026-02']).toMatchObject({ newHours: 8, returningHours: 6 })
    expect(byKey['2026-03']).toMatchObject({ newHours: 3, returningHours: 5 })
    expect(byKey['2026-04']).toMatchObject({ newHours: 0, returningHours: 12, newVolunteers: 0 })
    expect(byKey['2026-05']).toMatchObject({ newHours: 4, returningHours: 0 })
    expect(byKey['2026-06']).toMatchObject({ newHours: 0, returningHours: 25 })
  })

  it('splits the same total the time series reports', async () => {
    const { newVsReturning, summary } = await report()
    const total = newVsReturning.reduce((sum, point) => sum + point.newHours + point.returningHours, 0)
    expect(total).toBeCloseTo(summary.totalHours, 6)
  })
})

describe('retention cohorts', () => {
  it('groups volunteers by the month they signed up', async () => {
    const { retention } = await report()
    // Newest cohort first. Cara (2024) and Eve (2025) signed up before the
    // range, so they get no row.
    expect(retention.rows.map(row => row.cohort)).toEqual(['2026-05', '2026-04', '2026-03', '2026-02'])
    expect(retention.rows.every(row => row.size === 1)).toBe(true)
  })

  it('falls back to the first logged hour for a volunteer with no account', async () => {
    // Frank has no `User` row, so there is no signup date to cohort him by.
    const { retention } = await report()
    expect(retention.rows.find(row => row.cohort === '2026-05')).toBeDefined()
  })

  it('reads each cell as the share of the cohort active that month', async () => {
    const { retention } = await report()
    const byCohort = Object.fromEntries(retention.rows.map(row => [row.cohort, row.values]))

    // Alice: active in Feb and Mar, quiet from April on.
    expect(byCohort['2026-02']).toEqual([100, 100, 0, 0, 0, null])
    // Bob: nothing in his signup month, back in April.
    expect(byCohort['2026-03']).toEqual([0, 100, 0, 0, null, null])
  })

  it('leaves a cell null rather than 0% where there is no month to measure', async () => {
    // A zero there would read as total churn instead of "not yet".
    const { retention } = await report()
    const may = retention.rows.find(row => row.cohort === '2026-05')!
    expect(may.values).toEqual([100, 0, null, null, null, null])
    expect(retention.columns).toEqual(['M0', 'M1', 'M2', 'M3', 'M4', 'M5'])
  })
})

describe('empty range', () => {
  it('returns a well-formed zeroed report rather than nulls or NaN', async () => {
    const { summary, series, distribution, coverage } = await report({
      from: '2020-01-01', to: '2020-03-31', granularity: 'month',
    })

    expect(summary.totalHours).toBe(0)
    expect(summary.activeVolunteers).toBe(0)
    expect(summary.meanHoursPerVolunteer).toBe(0)
    expect(summary.medianHoursPerVolunteer).toBe(0)
    expect(summary.topDecileShare).toBe(0)
    expect(Object.values(summary).every(value => Number.isFinite(value))).toBe(true)

    // The axis still has its buckets, so the chart draws a flat line at zero
    // rather than collapsing to an empty card.
    expect(series).toHaveLength(3)
    expect(series.every(point => point.hours === 0)).toBe(true)
    expect(distribution.max).toBe(0)
    expect(coverage.cells).toHaveLength(28)
  })
})
