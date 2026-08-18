import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { at, createFakeEvent, createHourLog, createVolunteer, resetDatabase } from '../setup/fixtures'

/**
 * End-to-end checks on `/api/admin/reports/export` — the CSV a coordinator
 * attaches to a grant application.
 *
 * Two classes of defect matter here beyond the arithmetic. One is a file Excel
 * mangles: a missing BOM turns an accented name into mojibake, and an unescaped
 * leading `=` in a volunteer's name is evaluated as a formula on open. The
 * other is a file whose numbers disagree with the dashboard for the same range,
 * which is the whole reason this endpoint shares `parseReportQuery` with it.
 */
vi.mock('#server/utils/requireRole', () => ({
  requireRole: vi.fn(async () => ({ user: { id: 'admin-user' }, session: {} })),
}))

const { default: handler } = await import('#server/api/admin/reports/export.get')

const NOW = new Date('2026-08-17T19:00:00Z')
const RANGE = { preset: 'CUSTOM', from: '2026-01-01', to: '2026-06-30' }
const RATE = 34.79

/**
 * Three volunteers chosen for what their names and hours do to a CSV:
 *   Jane   — a comma in the name, a comma in the event, an explicit program
 *   "Q"    — double quotes in the name, an inferred program
 *   =SUM   — a name Excel would evaluate, and pending hours
 *   Bob    — four logs straddling both ends of the range, to the half hour
 */
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)

  await resetDatabase()

  const jane = await createVolunteer({ name: 'Smith, Jane', email: 'jane@example.test' })
  const quoted = await createVolunteer({ name: 'Quote "Q" Person', email: 'q@example.test', areas: ['EVENT_SUPPORT'] })
  const formula = await createVolunteer({ name: '=SUM(A1:A9)', email: 'danger@example.test' })
  const bob = await createVolunteer({ name: 'Boundary Bob', email: 'bob@example.test' })

  await createHourLog({
    volunteerId: jane.id,
    date: at(2026, 2, 3),
    hours: 2.5,
    program: 'CLINIC_SUPPORT',
    eventName: 'Clinic, morning',
    comment: 'Went well',
  })
  await createHourLog({ volunteerId: quoted.id, date: at(2026, 4, 5), hours: 4 })
  await createHourLog({ volunteerId: formula.id, date: at(2026, 3, 4), hours: 1.5, status: 'PENDING' })

  // Late-evening Central logs on the range's edges. In UTC — which is how the
  // server's clock reads — two of these fall on the wrong side of the boundary.
  await createHourLog({ volunteerId: bob.id, date: at(2025, 12, 31, 23), hours: 9 })
  await createHourLog({ volunteerId: bob.id, date: at(2026, 1, 1, 0), hours: 11 })
  await createHourLog({ volunteerId: bob.id, date: at(2026, 6, 30, 23), hours: 13 })
  await createHourLog({ volunteerId: bob.id, date: at(2026, 7, 1, 0), hours: 17 })
})

afterAll(async () => {
  vi.useRealTimers()
  await resetDatabase()
})

async function exportCsv(query: Record<string, string> = {}) {
  const event = createFakeEvent({ query: { ...RANGE, ...query } })
  const body = await (handler as (e: typeof event) => Promise<string>)(event)
  return { body, headers: event.__responseHeaders, lines: body.split('\r\n') }
}

describe('file mechanics', () => {
  it('starts with a UTF-8 BOM and uses CRLF, as Excel expects', async () => {
    const { body, lines } = await exportCsv()
    expect(body.startsWith('﻿')).toBe(true)
    expect(body).toContain('\r\n')
    expect(body).not.toMatch(/[^\r]\n/) // no bare LF anywhere
    expect(lines.at(-1)).toBe('') // trailing CRLF
  })

  it('offers the file as a download named after the period it covers', async () => {
    const { headers } = await exportCsv()
    expect(headers['content-type']).toBe('text/csv; charset=utf-8')
    expect(headers['content-disposition'])
      .toBe('attachment; filename="abide-volunteer-hours-logs-2026-01-01-to-2026-06-30.csv"')
    // A cached copy served for a different period is worse than a round-trip.
    expect(headers['cache-control']).toBe('no-store')
  })

  it('names the dataset in the filename', async () => {
    for (const dataset of ['logs', 'volunteers', 'programs']) {
      const { headers } = await exportCsv({ dataset })
      expect(headers['content-disposition'], dataset).toContain(`-${dataset}-2026-01-01-to-2026-06-30.csv`)
    }
  })

  it('falls back to the log-level dataset for an unknown grain', async () => {
    const { headers, lines } = await exportCsv({ dataset: 'everything' })
    expect(headers['content-disposition']).toContain('-logs-')
    expect(lines[9]).toContain('Date,Volunteer,Email,Event,Program,Hours')
  })
})

describe('the header block', () => {
  it('states the period, the rate and its source, so a forwarded file explains itself', async () => {
    const { lines } = await exportCsv()
    expect(lines.slice(0, 8)).toEqual([
      '﻿Abide Connect — volunteer hours export',
      'Period,"Jan 1 – Jun 30, 2026"',
      'From,2026-01-01',
      'To,2026-06-30',
      'Hours counted,Approved only',
      `Volunteer hourly rate,${RATE}`,
      'Rate source,"Independent Sector, value of volunteer time"',
      `Generated,${NOW.toISOString()}`,
    ])
  })

  it('says which statuses were counted', async () => {
    expect((await exportCsv({ status: 'all' })).lines[4]).toBe('Hours counted,Approved and pending')
  })

  it('quotes a header value that contains a comma', async () => {
    // Unquoted, "Jan 1 – Jun 30, 2026" would read as two fields and the year
    // would land in a column of its own.
    const { lines } = await exportCsv()
    expect(lines[1]).toBe('Period,"Jan 1 – Jun 30, 2026"')
    expect(lines[6]).toBe('Rate source,"Independent Sector, value of volunteer time"')
  })
})

describe('escaping', () => {
  it('defuses a name Excel would evaluate as a formula', async () => {
    // Not cosmetic: a name or comment beginning `=`, `+`, `-` or `@` runs on
    // open, and these files are opened by people outside the org.
    const { body } = await exportCsv({ status: 'all' })
    expect(body).toContain('\'=SUM(A1:A9)')
    expect(body).not.toMatch(/(^|,)=SUM/)
  })

  it('quotes a field containing a comma', async () => {
    const { body } = await exportCsv()
    expect(body).toContain('"Smith, Jane"')
    expect(body).toContain('"Clinic, morning"')
  })

  it('doubles an embedded quote and wraps the field', async () => {
    const { body } = await exportCsv()
    expect(body).toContain('"Quote ""Q"" Person"')
  })

  it('leaves an ordinary field unquoted', async () => {
    const { body } = await exportCsv()
    expect(body).toContain(',jane@example.test,')
    expect(body).toContain(',Went well')
  })
})

describe('the logs dataset', () => {
  const dataRows = (lines: string[]) =>
    lines.slice(lines.findIndex(line => line.startsWith('Date,Volunteer')) + 1)
      .filter(line => line.length > 0 && !line.startsWith('Total '))

  it('writes one row per hour log, oldest first', async () => {
    const { lines } = await exportCsv()
    const rows = dataRows(lines)
    // Bob Jan 1 · Jane Feb 3 · Quote Apr 5 · Bob Jun 30 — the pending row is out.
    expect(rows).toHaveLength(4)
    expect(rows.map(row => row.split(',')[0])).toEqual([
      '2026-01-01', '2026-02-03', '2026-04-05', '2026-06-30',
    ])
  })

  it('carries the attributed program and the row\'s own in-kind value', async () => {
    const { lines } = await exportCsv()
    const jane = dataRows(lines).find(row => row.includes('Smith, Jane'))!
    // 2.5 × 34.79 = 86.975, to the cent.
    expect(jane).toBe('2026-02-03,"Smith, Jane",jane@example.test,"Clinic, morning",Clinic Support,2.5,86.98,APPROVED,Went well')
  })

  it('labels an inferred program the same as an explicit one', async () => {
    // The CSV states the attribution; the programs dataset is where the split
    // between stated and inferred is reported.
    const { lines } = await exportCsv()
    expect(dataRows(lines).find(row => row.includes('Quote'))).toContain(',Event Support,4,139.16,APPROVED,')
  })

  it('describes a log with neither event nor free-text as a manual submission', async () => {
    const { lines } = await exportCsv()
    const bobRow = dataRows(lines).find(row => row.startsWith('2026-01-01'))!
    expect(bobRow).toContain(',Manual submission,')
  })

  it('shows the status of every row it includes', async () => {
    const { lines } = await exportCsv({ status: 'all' })
    const statuses = dataRows(lines).map(row => row.split(',').at(-2))
    expect(statuses).toContain('PENDING')
    expect(statuses).not.toContain('REJECTED')
  })
})

describe('range boundaries', () => {
  it('counts a late-evening Central log on the first and last day of the range', async () => {
    // Bob's four logs sit at 11pm on Dec 31, midnight on Jan 1, 11pm on Jun 30
    // and midnight on Jul 1. In UTC the first and third read as the next day.
    const { lines } = await exportCsv({ dataset: 'volunteers' })
    const bob = lines.find(line => line.startsWith('Boundary Bob'))!
    // 11 + 13 = 24 hours over 2 entries; the 9h and 17h are outside.
    expect(bob).toBe(`Boundary Bob,bob@example.test,2,24,${24 * RATE}`)
  })
})

describe('the volunteers dataset', () => {
  it('totals each volunteer once, ranked by hours', async () => {
    const { lines } = await exportCsv({ dataset: 'volunteers' })
    const start = lines.findIndex(line => line.startsWith('Volunteer,Email')) + 1
    const rows = lines.slice(start).filter(line => line.length > 0 && !line.startsWith('Total '))

    expect(rows.map(row => row.split(',').at(-2))).toEqual(['24', '4', '2.5'])
    expect(rows).toHaveLength(3) // the pending-only volunteer has no approved hours
  })
})

describe('the programs dataset', () => {
  it('totals by program and says how much was attributed by inference', async () => {
    const { lines } = await exportCsv({ dataset: 'programs' })
    const start = lines.findIndex(line => line.startsWith('Program,Volunteers')) + 1
    const rows = lines.slice(start).filter(line => line.length > 0 && !line.startsWith('Total '))

    expect(rows).toEqual([
      `Unassigned,1,24,${24 * RATE},0`,
      `Event Support,1,4,${4 * RATE},4`, // all four hours inferred from Q's one area
      `Clinic Support,1,2.5,86.98,0`, // tagged on the log itself
    ])
  })
})

describe('totals footer', () => {
  it('closes every dataset with the same total', async () => {
    for (const dataset of ['logs', 'volunteers', 'programs']) {
      const { lines } = await exportCsv({ dataset })
      // 24 + 4 + 2.5 = 30.5 approved hours in the range.
      expect(lines.at(-3), dataset).toBe('Total hours,30.5')
      expect(lines.at(-2), dataset).toBe('Total in-kind value (USD),1061.1')
    }
  })

  it('moves the total when the status filter widens', async () => {
    const { lines } = await exportCsv({ status: 'all' })
    expect(lines.at(-3)).toBe('Total hours,32') // + the pending 1.5h
  })

  it('rejects an unparseable range rather than exporting a different one', async () => {
    await expect(exportCsv({ from: 'whenever', to: '2026-06-30' }))
      .rejects.toMatchObject({ statusCode: 400 })
  })
})
