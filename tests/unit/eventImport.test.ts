import { describe, it, expect } from 'vitest'
import { parseCsvRows } from '#server/utils/csv'
import {
  findHeaderRow,
  mapEventType,
  parseClockTime,
  parseMondayDate,
  planEventImport,
  resolveEventColumns,
} from '#server/utils/eventImport'

/**
 * The event importer's mapping layer.
 *
 * Two things carry most of the risk and so most of the cases: finding the
 * header inside the scaffolding a board export wraps around it, and reading
 * "when" as Central wall-clock time. The suite runs with `TZ=UTC`, as
 * production does, so a parser that leans on the host zone puts a 9am event at
 * 4am and fails here.
 */

describe('resolveEventColumns', () => {
  it('matches the plain board columns', () => {
    expect(resolveEventColumns(['Name', 'Date', 'Location', 'Description', 'Type'])).toEqual({
      title: 0, date: 1, location: 2, description: 3, eventType: 4,
    })
  })

  it('gives the narrow field first claim on a header the broad one also matches', () => {
    const columns = resolveEventColumns(['Event Name', 'Start Date', 'End Date', 'Short Description', 'Description'])
    expect(columns.date).toBe(1)
    expect(columns.endDate).toBe(2)
    expect(columns.shortDesc).toBe(3)
    expect(columns.description).toBe(4)
  })

  it('does not take Monday\'s bookkeeping dates for the event date', () => {
    expect(resolveEventColumns(['Name', 'Creation Date', 'Last Updated Date']).date).toBeUndefined()
  })
})

describe('findHeaderRow', () => {
  it('steps over the board name and group heading above the header', () => {
    const rows = [['Community Events'], ['Spring 2026'], ['Name', 'Date', 'Location']]
    expect(findHeaderRow(rows)).toBe(2)
  })

  it('reports -1 for a file with nothing to date an event by', () => {
    expect(findHeaderRow([['Name', 'Owner'], ['Baby shower', 'Dana']])).toBe(-1)
  })
})

describe('parseClockTime', () => {
  it('reads 12-hour and 24-hour times', () => {
    expect(parseClockTime('9:30 AM')).toEqual({ hour: 9, minute: 30 })
    expect(parseClockTime('12:00 PM')).toEqual({ hour: 12, minute: 0 })
    expect(parseClockTime('12:15 am')).toEqual({ hour: 0, minute: 15 })
    expect(parseClockTime('6pm')).toEqual({ hour: 18, minute: 0 })
    expect(parseClockTime('14:05')).toEqual({ hour: 14, minute: 5 })
    expect(parseClockTime('09:00:00')).toEqual({ hour: 9, minute: 0 })
  })

  it('rejects what is not a time', () => {
    expect(parseClockTime('25:00')).toBeNull()
    expect(parseClockTime('13 PM')).toBeNull()
    expect(parseClockTime('morning')).toBeNull()
  })
})

describe('parseMondayDate', () => {
  it('reads the three date shapes an export produces', () => {
    const expected = { year: 2026, month: 3, day: 14, time: null }
    expect(parseMondayDate('2026-03-14')).toEqual(expected)
    expect(parseMondayDate('Mar 14, 2026')).toEqual(expected)
    expect(parseMondayDate('March 14, 2026')).toEqual(expected)
    expect(parseMondayDate('3/14/2026')).toEqual(expected)
  })

  it('keeps a time that rides along in the cell', () => {
    expect(parseMondayDate('2026-03-14 09:00')?.time).toEqual({ hour: 9, minute: 0 })
    expect(parseMondayDate('Mar 14, 2026 6:30 PM')?.time).toEqual({ hour: 18, minute: 30 })
    expect(parseMondayDate('2026-03-14T18:30:00')?.time).toEqual({ hour: 18, minute: 30 })
  })

  it('rejects dates that do not exist rather than rolling them forward', () => {
    expect(parseMondayDate('2026-02-30')).toBeNull()
    expect(parseMondayDate('13/01/2026')).toBeNull()
    expect(parseMondayDate('TBD')).toBeNull()
  })
})

describe('mapEventType', () => {
  it('maps the labels a board uses', () => {
    expect(mapEventType('Volunteer Training')).toBe('TRAINING')
    expect(mapEventType('Volunteers only')).toBe('VOLUNTEERS')
    expect(mapEventType('Public')).toBe('ATTENDEES')
    expect(mapEventType('Community + Volunteers')).toBe('VOLUNTEERS_AND_ATTENDEES')
  })

  it('leaves an unrecognised label to the default rather than guessing public', () => {
    expect(mapEventType('Internal')).toBeNull()
    expect(mapEventType('')).toBeNull()
  })
})

describe('planEventImport', () => {
  const plan = (text: string) => planEventImport(parseCsvRows(text))!

  it('returns null when the file has no header row', () => {
    expect(planEventImport(parseCsvRows('just,some\ncells,here'))).toBeNull()
  })

  it('reads the date as Central wall-clock time', () => {
    const { events } = plan([
      'Name,Date,Start Time,End Time,Location',
      // CDT (UTC-5) — DST began on 8 March 2026. 9:00 → 14:00Z, 13:00 → 18:00Z.
      'Diaper Drive,2026-03-14,9:00 AM,1:00 PM,"123 Main St, Dallas, TX"',
      // CST (UTC-6). 18:30 → 00:30Z the next day; one hour later for the end.
      'Info Night,"Jan 10, 2026 6:30 PM",,,',
    ].join('\n'))

    expect(events[0]!.startTime.toISOString()).toBe('2026-03-14T14:00:00.000Z')
    expect(events[0]!.endTime.toISOString()).toBe('2026-03-14T18:00:00.000Z')
    expect(events[0]!.location).toBe('123 Main St, Dallas, TX')
    expect(events[0]!.warnings).toEqual([])

    expect(events[1]!.startTime.toISOString()).toBe('2026-01-11T00:30:00.000Z')
    expect(events[1]!.endTime.toISOString()).toBe('2026-01-11T01:30:00.000Z')
    expect(events[1]!.location).toBeNull()
    expect(events[1]!.warnings).toEqual(['No end time — assumed one hour.'])
  })

  it('assumes a working day for a row with a date and no time, and says so', () => {
    const { events } = plan('Name,Date\nHealth Fair,2026-06-06')

    // CDT: 9:00 → 14:00Z, 17:00 → 22:00Z.
    expect(events[0]!.startTime.toISOString()).toBe('2026-06-06T14:00:00.000Z')
    expect(events[0]!.endTime.toISOString()).toBe('2026-06-06T22:00:00.000Z')
    expect(events[0]!.warnings).toEqual(['No time on this row — assumed 9:00 AM to 5:00 PM.'])
  })

  it('reads a timeline range and a time range', () => {
    const { events } = plan([
      'Name,Timeline,Time',
      'Retreat,2026-06-05 - 2026-06-06,',
      'Clinic Day,2026-06-08,8:00 AM - 12:00 PM',
    ].join('\n'))

    expect(events[0]!.startTime.toISOString()).toBe('2026-06-05T14:00:00.000Z')
    expect(events[0]!.endTime.toISOString()).toBe('2026-06-06T22:00:00.000Z')
    // CDT: 8:00 → 13:00Z, 12:00 → 17:00Z.
    expect(events[1]!.startTime.toISOString()).toBe('2026-06-08T13:00:00.000Z')
    expect(events[1]!.endTime.toISOString()).toBe('2026-06-08T17:00:00.000Z')
  })

  it('skips board scaffolding instead of reporting it as broken events', () => {
    const result = plan([
      'Community Events',
      'Spring',
      'Name,Date',
      'Diaper Drive,2026-03-14',
      '',
      'Summer',
      'Name,Date',
      'Health Fair,2026-06-06',
    ].join('\n'))

    expect(result.totalRows).toBe(2)
    expect(result.events.map(e => e.title)).toEqual(['Diaper Drive', 'Health Fair'])
    expect(result.events.map(e => e.rowNumber)).toEqual([4, 8])
    expect(result.rejected).toEqual([])
  })

  it('rejects rows it cannot place in time, and repeats within the file', () => {
    const result = plan([
      'Name,Date,Start Time,End Time',
      'No Date Yet,,6:00 PM,',
      'Typo,2026-13-01,,',
      'Backwards,2026-03-14,5:00 PM,9:00 AM',
      'Diaper Drive,2026-03-14,9:00 AM,1:00 PM',
      'diaper drive,2026-03-14,9:00 AM,2:00 PM',
      ',2026-03-15,9:00 AM,',
    ].join('\n'))

    expect(result.events.map(e => e.title)).toEqual(['Diaper Drive'])
    expect(result.rejected).toEqual([
      { rowNumber: 2, title: 'No Date Yet', errors: ['No date.'] },
      { rowNumber: 3, title: 'Typo', errors: ['Could not read "2026-13-01" as a date.'] },
      { rowNumber: 4, title: 'Backwards', errors: ['The event ends before it starts.'] },
      { rowNumber: 6, title: 'diaper drive', errors: ['Duplicate of row 5.'] },
      { rowNumber: 7, title: '', errors: ['No event name.'] },
    ])
  })

  it('flags a type it does not recognise and names the optional columns that are missing', () => {
    const result = plan('Name,Date,Type\nBoard Meeting,2026-03-14,Internal')

    expect(result.missingColumns).toEqual(['Location', 'Description'])
    expect(result.events[0]!.eventType).toBeNull()
    expect(result.events[0]!.eventTypeRaw).toBe('Internal')
    expect(result.events[0]!.warnings).toContain('Type "Internal" was not recognised — the default was used.')
  })
})
