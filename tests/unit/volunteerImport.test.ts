import { describe, it, expect } from 'vitest'
import { parseCsv, parseCsvRows } from '#server/utils/csv'
import {
  mapEthnicity,
  mapLanguages,
  mapAreas,
  mapCertifications,
  mapAvailability,
  parseEmergencyContacts,
  parseMondayTimestamp,
  normalizePhone,
  resolveColumns,
  planImport,
} from '#server/utils/volunteerImport'

/**
 * The CSV importer's mapping layer.
 *
 * Every expectation here is a real value from the September 2026 volunteer
 * export, not an invented one — the whole difficulty of this code is that the
 * answers are free text written by 262 different people, and a fixture that
 * says "Black" tests nothing that was ever going to break. The cases that
 * earned their place are the ones that were wrong first time round: "American
 * Indian" read as Asian, "non-Hispanic" read as Hispanic, and a name and phone
 * on two lines read as two separate contacts.
 */

describe('parseCsvRows', () => {
  it('keeps commas, newlines and doubled quotes inside quoted fields', () => {
    const rows = parseCsvRows('a,"b,c","line1\nline2","say ""hi"""\n1,2,3,4')
    expect(rows).toEqual([
      ['a', 'b,c', 'line1\nline2', 'say "hi"'],
      ['1', '2', '3', '4'],
    ])
  })

  it('normalises CRLF, including inside a quoted field', () => {
    expect(parseCsvRows('a,b\r\nc,"d\r\ne"')).toEqual([['a', 'b'], ['c', 'd\ne']])
  })

  it('does not emit a trailing empty record for a final newline', () => {
    expect(parseCsvRows('a,b\n1,2\n')).toHaveLength(2)
  })

  it('reads short rows as empty strings rather than undefined', () => {
    const { records } = parseCsv('a,b,c\n1,2')
    expect(records[0]).toEqual({ a: '1', b: '2', c: '' })
  })
})

describe('resolveColumns', () => {
  it('matches the export\'s paragraph-long questions by keyword', () => {
    const columns = resolveColumns([
      'First Name',
      'What is your race / ethnicity?',
      'If you answered yes to the previous question, what language(s) are you fluent in?',
      'Code of Conduct and Confidentiality/NDA  Acknowledgement',
      'Created at',
      'Signature',
    ])
    expect(columns.firstName).toBe('First Name')
    expect(columns.ethnicity).toBe('What is your race / ethnicity?')
    expect(columns.languages).toContain('language(s) are you fluent')
    // Double space in the header, as the export writes it.
    expect(columns.codeOfConduct).toContain('Code of Conduct')
    expect(columns.submittedAt).toBe('Created at')
  })

  it('does not mistake the signature column for the code-of-conduct one', () => {
    const columns = resolveColumns(['Code of Conduct and Confidentiality/NDA  Acknowledgement', 'Signature'])
    expect(columns.signature).toBe('Signature')
    expect(columns.codeOfConduct).not.toBe('Signature')
  })
})

describe('mapEthnicity', () => {
  it('reads the common single-category answers whatever the spelling', () => {
    for (const raw of ['Black', 'African American', 'bLACK', 'Afro American', 'Black - original people', 'African']) {
      expect(mapEthnicity(raw).value).toBe('BLACK_OR_AFRICAN_AMERICAN')
    }
    expect(mapEthnicity('White/caucasian').value).toBe('WHITE')
    expect(mapEthnicity('HISPANIC OR LATINO').value).toBe('HISPANIC')
    expect(mapEthnicity('South Asian (Indian)').value).toBe('ASIAN')
    expect(mapEthnicity('Iranian').value).toBe('MIDDLE_EASTERN_OR_NORTH_AFRICAN')
  })

  it('gives TWO_OR_MORE when two categories are named', () => {
    expect(mapEthnicity('African American and White').value).toBe('TWO_OR_MORE')
    expect(mapEthnicity('Black & Mexican').value).toBe('TWO_OR_MORE')
    expect(mapEthnicity('Black/Indigenous').value).toBe('TWO_OR_MORE')
  })

  it('gives TWO_OR_MORE when the answer says so without naming them', () => {
    expect(mapEthnicity('Two or more races').value).toBe('TWO_OR_MORE')
    expect(mapEthnicity('Biracial (Black and White)').value).toBe('TWO_OR_MORE')
    expect(mapEthnicity('Mixed').value).toBe('TWO_OR_MORE')
  })

  it('does not read "American Indian" as Indian', () => {
    // Both patterns can match this string; consuming the match is what stops it
    // counting twice and coming back as TWO_OR_MORE.
    expect(mapEthnicity('American Indian').value).toBe('OTHER')
  })

  it('does not read "non-Hispanic" as Hispanic', () => {
    expect(mapEthnicity('Black/African American, non-Hispanic').value).toBe('BLACK_OR_AFRICAN_AMERICAN')
    expect(mapEthnicity('Non hispanic').value).toBe('OTHER')
  })

  it('flags an answer that is not an ethnicity at all', () => {
    // Four people in the export typed the city they live in.
    expect(mapEthnicity('Flower Mound')).toEqual({ value: 'OTHER', unrecognised: true })
  })

  it('leaves a blank answer null rather than OTHER', () => {
    expect(mapEthnicity('')).toEqual({ value: null, unrecognised: false })
  })
})

describe('mapLanguages', () => {
  it('maps what the enum can name, however it is written', () => {
    expect(mapLanguages('Spanish').values).toEqual(['SPANISH'])
    expect(mapLanguages('Chinese (Mandarin)').values).toEqual(['CHINESE'])
    expect(mapLanguages('I speak an intermediate level of Spanish').values).toEqual(['SPANISH'])
    expect(mapLanguages('Hindi, Spanish, Malayalam').values).toEqual(expect.arrayContaining(['HINDI', 'SPANISH']))
  })

  it('sets OTHER and names the language the enum is missing', () => {
    const result = mapLanguages('Telegu')
    expect(result.values).toEqual(['OTHER'])
    // Both spellings in the export resolve to one name, so the report doesn't
    // list "Telugu" and "Telegu" as two different gaps.
    expect(result.unmapped).toEqual(['Telugu'])
    expect(mapLanguages('Sign language').unmapped).toEqual(['American Sign Language'])
  })

  it('splits on every separator people use', () => {
    const result = mapLanguages('Conversational French & Spanish & ASL')
    expect(result.values).toEqual(expect.arrayContaining(['FRENCH', 'SPANISH', 'OTHER']))
    expect(result.unmapped).toEqual(['American Sign Language'])
  })

  it('ignores prose rather than reporting it as a missing language', () => {
    const result = mapLanguages('I’m not fluent but can speak Spanish about 50 percent fluent and am working on getting better')
    expect(result.values).toEqual(['SPANISH'])
    expect(result.unmapped).toEqual([])
    expect(result.ignored.length).toBeGreaterThan(0)
  })

  it('treats "N/A" as no languages', () => {
    expect(mapLanguages('N/A')).toEqual({ values: [], unmapped: [], ignored: [] })
    expect(mapLanguages('Not Applicable').values).toEqual([])
  })

  it('does not read Malayalam as Malay', () => {
    expect(mapLanguages('Malayalam').values).toEqual(['OTHER'])
  })
})

describe('multi-select columns', () => {
  it('maps every option the export uses', () => {
    const areas = mapAreas('Clinic Support (Volunteers will not be seeing clients), Community Outreach, Event Support')
    expect(areas.values).toEqual(['CLINIC_SUPPORT', 'COMMUNITY_OUTREACH', 'EVENT_SUPPORT'])
    expect(areas.unmatched).toEqual([])

    const certs = mapCertifications('Doula Certification, Certified Teacher/Educator, CDL (Commercial Driver\'s License)')
    expect(certs.values).toEqual(['DOULA_CERTIFICATION', 'CERTIFIED_TEACHER_EDUCATOR', 'CDL'])

    const availability = mapAvailability('Weekend Mornings (before 12 pm), Weekday Evenings (4-8 pm)')
    expect(availability.values).toEqual(['WEEKEND_MORNING', 'WEEKDAY_EVENING'])
  })

  it('reports an option it does not recognise instead of dropping it silently', () => {
    expect(mapAreas('Event Support, Interpretive Dance').unmatched).toEqual(['Interpretive Dance'])
  })

  it('splits on ", " so an option containing a comma survives', () => {
    expect(mapCertifications('CDL (Commercial Driver\'s License)').values).toEqual(['CDL'])
  })
})

describe('parseEmergencyContacts', () => {
  it('splits a name and number written on one line', () => {
    expect(parseEmergencyContacts('Amir Torabi, 256-249-8853')).toMatchObject({ name1: 'Amir Torabi', phone1: '256-249-8853' })
    expect(parseEmergencyContacts('Hass Johnson (spouse) - 512-673-7401')).toMatchObject({ name1: 'Hass Johnson (spouse)', phone1: '512-673-7401' })
    expect(parseEmergencyContacts('Uma Dakshinamurthy: 9737525883')).toMatchObject({ name1: 'Uma Dakshinamurthy', phone1: '973-752-5883' })
  })

  it('keeps the relationship in the name, brackets intact', () => {
    expect(parseEmergencyContacts('Konya Tyler (mom) 913-209-7553').name1).toBe('Konya Tyler (mom)')
  })

  it('treats a name and a number on two lines as one contact', () => {
    expect(parseEmergencyContacts('Sunday Adeniyi \n+1 (682) 248-1891')).toMatchObject({
      name1: 'Sunday Adeniyi',
      phone1: '682-248-1891',
      name2: null,
      phone2: null,
    })
  })

  it('treats two complete contacts as two contacts', () => {
    expect(parseEmergencyContacts('Aliska Bodden 504-905-4861\nNicole Thomas +1 (214) 929-0196')).toMatchObject({
      name1: 'Aliska Bodden',
      phone1: '504-905-4861',
      name2: 'Nicole Thomas',
      phone2: '214-929-0196',
    })
  })

  it('accepts a bare number or a bare name', () => {
    expect(parseEmergencyContacts('9133398853')).toMatchObject({ name1: null, phone1: '913-339-8853', unparsed: false })
    expect(parseEmergencyContacts('Harold morrel')).toMatchObject({ name1: 'Harold morrel', phone1: null, unparsed: false })
  })

  it('does not flag an answer that declines the question', () => {
    for (const raw of ['', 'NA', 'Na', 'I do not have one']) {
      expect(parseEmergencyContacts(raw).unparsed).toBe(false)
    }
  })
})

describe('parseMondayTimestamp', () => {
  it('reads the export format as the org\'s wall clock, not the host\'s', () => {
    // The suite runs with TZ=UTC, like production. 6:02 PM Central on 21 Jan
    // 2025 (CST, UTC-6) is 00:02 UTC the next day — a naive `new Date()` here
    // would keep it on the 21st at 18:02 and bucket it a day early.
    expect(parseMondayTimestamp('Jan 21, 2025 6:02 PM')?.toISOString()).toBe('2025-01-22T00:02:00.000Z')
    // July is CDT (UTC-5).
    expect(parseMondayTimestamp('Jul 8, 2025 1:42 PM')?.toISOString()).toBe('2025-07-08T18:42:00.000Z')
  })

  it('handles midnight and noon on the right side of the meridiem', () => {
    expect(parseMondayTimestamp('Jan 22, 2025 12:19 AM')?.toISOString()).toBe('2025-01-22T06:19:00.000Z')
    expect(parseMondayTimestamp('Jan 22, 2025 12:19 PM')?.toISOString()).toBe('2025-01-22T18:19:00.000Z')
  })

  it('returns null for anything it cannot read', () => {
    expect(parseMondayTimestamp('sometime last spring')).toBeNull()
    expect(parseMondayTimestamp('')).toBeNull()
  })
})

describe('normalizePhone', () => {
  it('formats to the shape already in the users table', () => {
    expect(normalizePhone('14694329400')).toBe('469-432-9400')
    expect(normalizePhone('2148869776')).toBe('214-886-9776')
    expect(normalizePhone('(469) 432-9400')).toBe('469-432-9400')
  })

  it('leaves something it cannot read alone rather than mangling it', () => {
    expect(normalizePhone('ext. 4')).toBe('ext. 4')
    expect(normalizePhone('')).toBeNull()
  })
})

describe('planImport', () => {
  const headers = [
    'First Name', 'Last Name', 'Phone Number', 'Email Address', 'Gender',
    'What is your race / ethnicity?',
    'Have you attended any of our volunteer training sessions?',
    'Please provide your availability:',
    'Emergency Contact Information',
    'Created at',
  ]

  const row = (values: Partial<Record<string, string>>) =>
    Object.fromEntries(headers.map(h => [h, values[h] ?? ''])) as Record<string, string>

  it('collapses repeat submissions onto one applicant, keeping every submission', () => {
    const plan = planImport([
      row({
        'First Name': 'Kimbely', 'Last Name': 'Rankin', 'Email Address': 'K.Rankin@Yahoo.com',
        'Created at': 'Jan 22, 2025 12:02 AM',
      }),
      row({
        'First Name': 'Kimbely', 'Last Name': 'Rankin', 'Email Address': 'k.rankin@yahoo.com',
        'Gender': 'Female', 'Please provide your availability:': 'Weekend Mornings (before 12 pm)',
        'Emergency Contact Information': 'Deshondra Starkes +1 (409) 454-2210',
        'Created at': 'Jul 23, 2025 1:31 PM',
      }),
    ], headers)

    expect(plan.applicants).toHaveLength(1)
    const applicant = plan.applicants[0]!
    // Addresses are normalised, so a change of capitalisation is the same person.
    expect(applicant.email).toBe('k.rankin@yahoo.com')
    expect(applicant.submissions).toHaveLength(2)
    expect(applicant.profile.gender).toBe('FEMALE')
    expect(applicant.profile.emergencyContactName1).toBe('Deshondra Starkes')
  })

  it('takes each field from the most recent submission that answered it', () => {
    // The form gained questions over its life: a later submission that left a
    // field blank must not blank out an earlier answer.
    const plan = planImport([
      row({ 'Email Address': 'a@b.com', 'Gender': 'Female', 'Created at': 'Jan 1, 2025 9:00 AM' }),
      row({ 'Email Address': 'a@b.com', 'Created at': 'Feb 1, 2025 9:00 AM' }),
    ], headers)

    expect(plan.applicants[0]!.profile.gender).toBe('FEMALE')
  })

  it('approves someone who reports having attended a training', () => {
    const plan = planImport([
      row({ 'Email Address': 'a@b.com', 'Have you attended any of our volunteer training sessions?': 'Yes', 'Created at': 'Jan 1, 2025 9:00 AM' }),
      row({ 'Email Address': 'c@d.com', 'Have you attended any of our volunteer training sessions?': 'No', 'Created at': 'Jan 1, 2025 9:00 AM' }),
    ], headers)

    const byEmail = new Map(plan.applicants.map(a => [a.email, a.profile.approvalStatus]))
    expect(byEmail.get('a@b.com')).toBe('APPROVED')
    expect(byEmail.get('c@d.com')).toBe('PENDING')
  })

  it('rejects a row with no email or no submission date rather than importing half of it', () => {
    const plan = planImport([
      row({ 'First Name': 'No', 'Last Name': 'Email', 'Created at': 'Jan 1, 2025 9:00 AM' }),
      row({ 'Email Address': 'a@b.com' }),
    ], headers)

    expect(plan.applicants).toHaveLength(0)
    expect(plan.rejected).toHaveLength(2)
    expect(plan.rejected[0]!.errors[0]).toContain('No email address')
    expect(plan.rejected[1]!.errors[0]).toContain('No submission date')
  })

  it('reports the columns this file does not have', () => {
    expect(planImport([], headers).missingColumns).toContain('certifications')
  })
})
