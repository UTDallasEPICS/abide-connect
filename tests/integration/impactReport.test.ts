import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImpactReport } from '#shared/types/reports'
import prisma from '#server/utils/prisma'
import { at, callHandler, createHourLog, createVolunteer, resetDatabase } from '../setup/fixtures'

/**
 * End-to-end checks on `/api/admin/reports/impact` — the funder view.
 *
 * The rules that make this report different from the operational one are the
 * ones most worth pinning down: it counts approved hours *only*, whatever the
 * caller asks for, and it multiplies them by a rate staff can change. A wrong
 * number here goes into a grant application.
 */
vi.mock('#server/utils/requireRole', () => ({
  requireRole: vi.fn(async () => ({ user: { id: 'admin-user' }, session: {} })),
}))

const { default: impactHandler } = await import('#server/api/admin/reports/impact.get')
const { default: settingsGet } = await import('#server/api/admin/reports/settings.get')
const { default: settingsPut } = await import('#server/api/admin/reports/settings.put')

const NOW = new Date('2026-08-17T19:00:00Z')
const RANGE = { preset: 'CUSTOM', from: '2026-01-01', to: '2026-06-30' }

/** Independent Sector's figure, and the built-in default. */
const DEFAULT_RATE = 34.79

/**
 * ┌───────┬──────────────────────┬───────────────────────────────────────────┐
 * │ Alice │ areas: clinic        │ Jan 15 10h (tagged) · Feb 15 5h (untagged)│
 * │ Bob   │ areas: event + comm. │ Mar 1 8h (untagged) · Apr 1 12h (tagged)  │
 * │ Cara  │ no areas             │ May 1 20h (untagged)                      │
 * └───────┴──────────────────────┴───────────────────────────────────────────┘
 * Plus a pending 100h and a rejected 50h that must never reach a funder, and
 * 50h across the same span of 2025 for the year-over-year comparison.
 */
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)

  await resetDatabase()

  const alice = await createVolunteer({ name: 'Alice Alvarez', areas: ['CLINIC_SUPPORT'] })
  const bob = await createVolunteer({ name: 'Bob Brennan', areas: ['EVENT_SUPPORT', 'COMMUNITY_OUTREACH'] })
  const cara = await createVolunteer({ name: 'Cara Chen' })

  await createHourLog({ volunteerId: alice.id, date: at(2026, 1, 15), hours: 10, program: 'CLINIC_SUPPORT' })
  await createHourLog({ volunteerId: alice.id, date: at(2026, 2, 15), hours: 5 })
  await createHourLog({ volunteerId: bob.id, date: at(2026, 3, 1), hours: 8 })
  await createHourLog({ volunteerId: bob.id, date: at(2026, 4, 1), hours: 12, program: 'MOBILE_CLINIC_OUTREACH' })
  await createHourLog({ volunteerId: cara.id, date: at(2026, 5, 1), hours: 20 })

  await createHourLog({ volunteerId: alice.id, date: at(2026, 6, 1), hours: 100, status: 'PENDING' })
  await createHourLog({ volunteerId: cara.id, date: at(2026, 6, 2), hours: 50, status: 'REJECTED' })

  await createHourLog({ volunteerId: alice.id, date: at(2025, 2, 1), hours: 20 })
  await createHourLog({ volunteerId: cara.id, date: at(2025, 5, 1), hours: 30 })
})

beforeEach(async () => {
  // Settings start unset, so each test sees the built-in defaults unless it
  // saves its own — `getReportingSettings` never inserts on read.
  await prisma.appSetting.deleteMany()
})

afterAll(async () => {
  vi.useRealTimers()
  await resetDatabase()
})

const impact = (query: Record<string, string> = {}) =>
  callHandler(impactHandler as never, { query: { ...RANGE, ...query } }) as Promise<ImpactReport>

describe('totals', () => {
  it('counts approved hours in the range and nothing else', async () => {
    const { totals } = await impact()
    // 10 + 5 + 8 + 12 + 20 = 55. The pending 100h and rejected 50h are out.
    expect(totals.hours).toBe(55)
    expect(totals.entries).toBe(5)
    expect(totals.volunteers).toBe(3)
  })

  it('ignores ?status=all — a funder never sees unreviewed hours', async () => {
    // The operational report honours this parameter; this one must not, or an
    // in-kind figure the org would have to walk back reaches a grant report.
    const wide = await impact({ status: 'all' })
    expect(wide.totals.hours).toBe(55)
    expect(wide.range.status).toBe('approved')
  })

  it('values hours at the configured rate', async () => {
    const { totals, rate } = await impact()
    expect(rate.hourlyRate).toBe(DEFAULT_RATE)
    // 55 × 34.79 = 1913.45
    expect(totals.inKindValue).toBe(1913.45)
    // 50 × 34.79 = 1739.50
    expect(totals.priorInKindValue).toBe(1739.5)
  })

  it('compares against the same span a year earlier', async () => {
    const { totals, priorRange } = await impact()
    expect(priorRange).toMatchObject({
      from: '2025-01-01', to: '2025-06-30', label: 'Jan 1 – Jun 30, 2025',
    })
    // 20 + 30 = 50 hours from two volunteers.
    expect(totals.priorHours).toBe(50)
    expect(totals.priorVolunteers).toBe(2)
    // (55 − 50) / 50 = +10%
    expect(totals.hoursChangePct).toBe(10)
  })

  it('reports no percentage rather than an infinite one against a zero baseline', async () => {
    // The org's first year has no prior period; "+∞% vs last year" is not a
    // sentence to put in front of a funder.
    const { totals } = await impact({ from: '2026-03-01', to: '2026-03-31' })
    expect(totals.priorHours).toBe(0)
    expect(totals.hoursChangePct).toBeNull()
  })

  it('derives the per-volunteer average and FTE from the same totals', async () => {
    const { totals } = await impact()
    // 55 / 3 = 18.33; 55 / 2080 = 0.026 of a full-time year.
    expect(totals.averageHoursPerVolunteer).toBe(18.3)
    expect(totals.fullTimeEquivalent).toBe(0.03)
  })

  it('zeroes cleanly over a range with no activity', async () => {
    const { totals } = await impact({ from: '2019-01-01', to: '2019-12-31' })
    expect(totals.hours).toBe(0)
    expect(totals.inKindValue).toBe(0)
    expect(totals.averageHoursPerVolunteer).toBe(0)
    expect(totals.hoursChangePct).toBeNull()
  })
})

describe('hours by program', () => {
  it('attributes hours by tag first, then by a single declared area', async () => {
    const { programs } = await impact()
    const byProgram = Object.fromEntries(programs.map(entry => [entry.program, entry]))

    // Alice's tagged 10h plus her untagged 5h, inferred from her one area.
    expect(byProgram.CLINIC_SUPPORT).toMatchObject({
      label: 'Clinic Support', hours: 15, inferredHours: 5, volunteers: 1,
    })
    // Bob's tag wins over his own areas, which name neither of these.
    expect(byProgram.MOBILE_CLINIC_OUTREACH).toMatchObject({
      label: 'Mobile Clinic Outreach', hours: 12, inferredHours: 0, volunteers: 1,
    })
  })

  it('parks hours it cannot attribute in Unassigned rather than guessing', async () => {
    const { programs } = await impact()
    const unassigned = programs.find(entry => entry.program === 'UNASSIGNED')!
    // Bob's untagged 8h (he declared two areas) and Cara's 20h (she declared
    // none) — 28 hours across two people, none of it inferred.
    expect(unassigned).toMatchObject({ label: 'Unassigned', hours: 28, volunteers: 2, inferredHours: 0 })
  })

  it('ranks programs by hours and accounts for every one of them', async () => {
    const { programs, totals } = await impact()
    expect(programs.map(entry => entry.program)).toEqual([
      'UNASSIGNED', 'CLINIC_SUPPORT', 'MOBILE_CLINIC_OUTREACH',
    ])
    const attributed = programs.reduce((sum, entry) => sum + entry.hours, 0)
    expect(attributed).toBeCloseTo(totals.hours, 6)
  })

  it('values each program at the same rate as the headline', async () => {
    const { programs, totals, rate } = await impact()
    const valued = programs.reduce((sum, entry) => sum + entry.value, 0)
    expect(valued).toBeCloseTo(totals.inKindValue, 2)
    expect(programs[0]!.value).toBe(Math.round(28 * rate.hourlyRate * 100) / 100)
  })
})

describe('year-over-year monthly series', () => {
  it('joins the two years by position, not by month key', async () => {
    const { monthly } = await impact()
    expect(monthly.map(point => point.key)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
    ])
    expect(monthly.map(point => point.hours)).toEqual([10, 5, 8, 12, 20, 0])
    // Alice's Feb 2025 20h and Cara's May 2025 30h line up under the same
    // month offsets a year later.
    expect(monthly.map(point => point.priorHours)).toEqual([0, 20, 0, 0, 30, 0])
  })

  it('sums each series back to its own total', async () => {
    const { monthly, totals } = await impact()
    expect(monthly.reduce((sum, p) => sum + p.hours, 0)).toBeCloseTo(totals.hours, 6)
    expect(monthly.reduce((sum, p) => sum + p.priorHours, 0)).toBeCloseTo(totals.priorHours, 6)
  })
})

describe('the hourly rate', () => {
  const saveSettings = (body: Record<string, unknown>) =>
    callHandler(settingsPut as never, { body })

  it('warns while the rate is still the built-in default', async () => {
    const { rate } = await impact()
    expect(rate.usingDefaults).toBe(true)
    expect(rate.hourlyRate).toBe(DEFAULT_RATE)
    expect(rate.source).toBe('Independent Sector, value of volunteer time')
    expect(rate.updatedAt).toBeNull()
  })

  it('revalues the whole report once staff enter their own rate', async () => {
    await saveSettings({
      volunteerHourlyRate: 40,
      volunteerHourlyRateSource: 'Independent Sector, 2026 update',
    })

    const { totals, programs, rate } = await impact()
    expect(rate.hourlyRate).toBe(40)
    expect(rate.source).toBe('Independent Sector, 2026 update')
    expect(rate.usingDefaults).toBe(false)
    expect(rate.updatedAt).not.toBeNull()

    // 55 × 40, and every program line moves with it.
    expect(totals.inKindValue).toBe(2200)
    expect(totals.priorInKindValue).toBe(2000)
    expect(programs.find(p => p.program === 'UNASSIGNED')!.value).toBe(1120)
  })

  it('saves one setting without blanking the others', async () => {
    await saveSettings({ volunteerHourlyRate: 40, volunteerHourlyRateSource: 'A cited source' })
    await saveSettings({ lapseThresholdDays: 90 })

    const settings = await callHandler(settingsGet as never) as {
      volunteerHourlyRate: number
      volunteerHourlyRateSource: string
      lapseThresholdDays: number
      defaults: { volunteerHourlyRate: number, lapseThresholdDays: number }
    }
    expect(settings.volunteerHourlyRate).toBe(40)
    expect(settings.volunteerHourlyRateSource).toBe('A cited source')
    expect(settings.lapseThresholdDays).toBe(90)
  })

  it('reports the defaults alongside the saved values, so reset has a target', async () => {
    const settings = await callHandler(settingsGet as never) as {
      defaults: { volunteerHourlyRate: number, lapseThresholdDays: number }
    }
    expect(settings.defaults).toEqual({ volunteerHourlyRate: DEFAULT_RATE, lapseThresholdDays: 60 })
  })

  it('rounds a saved rate to the cent', async () => {
    await saveSettings({ volunteerHourlyRate: 34.789_9 })
    expect((await impact()).rate.hourlyRate).toBe(34.79)
  })

  it('refuses a rate that is out of the range a dollars-per-hour figure lives in', async () => {
    // The rail that matters: a typo'd 3479 would multiply every in-kind total
    // on a grant report by a hundred.
    for (const rate of [0, -5, 3479, 1001, 'thirty']) {
      await expect(saveSettings({ volunteerHourlyRate: rate }), String(rate))
        .rejects.toMatchObject({ statusCode: 400 })
    }
    await expect(saveSettings({ volunteerHourlyRate: 1000 })).resolves.toBeDefined()
  })

  it('refuses a lapse threshold outside a usable window', async () => {
    for (const days of [0, 6, 731, 45.5]) {
      await expect(saveSettings({ lapseThresholdDays: days }), String(days))
        .rejects.toMatchObject({ statusCode: 400 })
    }
    await expect(saveSettings({ lapseThresholdDays: 7 })).resolves.toBeDefined()
    await expect(saveSettings({ lapseThresholdDays: 730 })).resolves.toBeDefined()
  })

  it('rejects an empty save rather than writing nothing and reporting success', async () => {
    await expect(saveSettings({})).rejects.toMatchObject({ statusCode: 400 })
  })

  it('falls back to the default when a stored value cannot be parsed', async () => {
    // Nothing in the app writes a bad value, but the table is hand-editable and
    // NaN would propagate into every dollar figure on the page.
    await prisma.appSetting.create({
      data: { key: 'reporting.volunteerHourlyRate', value: 'thirty-five dollars' },
    })

    const { rate, totals } = await impact()
    expect(rate.hourlyRate).toBe(DEFAULT_RATE)
    expect(totals.inKindValue).toBe(1913.45)
    // A row exists, so the page no longer claims the settings are untouched.
    expect(rate.usingDefaults).toBe(false)
  })
})
