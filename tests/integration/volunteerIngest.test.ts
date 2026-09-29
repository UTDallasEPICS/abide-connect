import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '#server/utils/prisma'
import { createVolunteer, resetDatabase } from '../setup/fixtures'
import { createFakeEvent } from '../setup/h3-globals'

/**
 * The CSV importer's write path, against the real schema.
 *
 * The mapping is covered by `tests/unit/volunteerImport.test.ts`; what is left
 * here is everything that can only go wrong against a database — that a preview
 * really writes nothing, that re-running a file is a no-op rather than a
 * duplicate set, and above all that the importer never overwrites a profile
 * someone already has. This is a bulk write of other people's records run by
 * hand from an unlisted page, so "it was supposed to skip that one" is not a
 * thing anyone should have to find out in production.
 */
vi.mock('#server/utils/requireRole', () => ({
  requireRole: vi.fn(async () => ({ user: { id: 'admin-user' }, session: {} })),
}))

const { default: ingest } = await import('#server/api/admin/ingest/volunteers.post')

/** One CSV row in column order, quoted so commas inside a cell survive. */
function row(values: (string | undefined)[]) {
  return values.map(v => `"${(v ?? '').replace(/"/g, '""')}"`).join(',')
}

// Quoted like every other row: two of these questions contain a comma, and an
// unquoted header row silently shifts every column after them.
const COLUMNS = [
  'First Name', 'Last Name', 'Phone Number', 'Email Address', 'Gender',
  'What is your race / ethnicity?',
  'Have you attended any of our volunteer training sessions?',
  'If you answered yes to the previous question, what language(s) are you fluent in?',
  'What area(s) would you like to assist with as a volunteer?',
  'Do you hold any certifications that could benefit our work?',
  'Please provide your availability:',
  'Emergency Contact Information',
  'Health and Safety Acknowledgement',
  'Signature',
  'Created at',
]
const HEADERS = row(COLUMNS)

const ROSA = row([
  'Rosa', 'Delgado', '14694329400', 'Rosa.Delgado@example.test', 'Female',
  'Black and white', 'No', 'Telugu',
  'Clinic Support (Volunteers will not be seeing clients), Event Support',
  'Doula Certification', 'Weekend Mornings (before 12 pm)',
  'Ana Delgado (mom) 214-674-5129', 'Yes', 'https://example.test/sig.png',
  'Jan 21, 2025 6:02 PM',
])

/** The same person, later, having since attended a training. */
const ROSA_AGAIN = row([
  'Rosa', 'Delgado', '14694329400', 'rosa.delgado@example.test', 'Female',
  'Black and white', 'Yes', 'Telugu',
  'Community Outreach', 'Doula Certification', 'Weekday Evenings (4-8 pm)',
  'Ana Delgado (mom) 214-674-5129', 'Yes', 'https://example.test/sig2.png',
  'Jul 23, 2025 1:31 PM',
])

const MARCUS = row([
  'Marcus', 'Obi', '2148869776', 'marcus@example.test', 'Male',
  'Dallas', 'No', '', 'Administrative Tasks', '', '', 'NA', 'Yes', '',
  'Mar 4, 2026 7:32 PM',
])

const csv = (...rows: string[]) => [HEADERS, ...rows].join('\n')

const run = (text: string, commit: boolean) =>
  (ingest as (e: ReturnType<typeof createFakeEvent>) => Promise<Result>)(
    createFakeEvent({ body: { csv: text, commit } }),
  )

interface Result {
  mode: string
  totalRows: number
  summary: Record<string, number>
  applicants: { email: string, action: string, approvalStatus: string, warnings: string[], error?: string }[]
  rejected: { rowNumber: number, errors: string[] }[]
}

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  await resetDatabase()
})

describe('preview', () => {
  it('writes nothing', async () => {
    const result = await run(csv(ROSA, MARCUS), false)

    expect(result.mode).toBe('preview')
    expect(result.summary.create).toBe(2)
    expect(result.summary.newSubmissions).toBe(2)
    expect(await prisma.user.count()).toBe(0)
    expect(await prisma.volunteer.count()).toBe(0)
    expect(await prisma.volunteer_Application.count()).toBe(0)
  })
})

describe('commit', () => {
  it('creates the user, profile, roles and submission', async () => {
    await run(csv(ROSA), true)

    const user = await prisma.user.findUnique({
      where: { email: 'rosa.delgado@example.test' },
      include: { roles: true, volunteer: { include: { languages: true, availabilities: true, volunteerAreas: true, certifications: true } } },
    })

    expect(user).not.toBeNull()
    expect(user!.name).toBe('Rosa Delgado')
    expect(user!.phone).toBe('469-432-9400')
    // Never signed in; the row is what lets them sign in by OTP later.
    expect(user!.emailVerified).toBe(false)
    expect(user!.roles.map(r => r.role).sort()).toEqual(['USER', 'VOLUNTEER'])

    const volunteer = user!.volunteer!
    expect(volunteer.approvalStatus).toBe('PENDING')
    expect(volunteer.gender).toBe('FEMALE')
    expect(volunteer.ethinicity).toBe('TWO_OR_MORE')
    expect(volunteer.ethinicityRaw).toBe('Black and white')
    expect(volunteer.languagesRaw).toBe('Telugu')
    expect(volunteer.languages.map(l => l.language)).toEqual(['OTHER'])
    expect(volunteer.emergencyContactName1).toBe('Ana Delgado (mom)')
    expect(volunteer.emergencyContactPhone1).toBe('214-674-5129')
    expect(volunteer.volunteerAreas.map(a => a.volunteerArea).sort()).toEqual(['CLINIC_SUPPORT', 'EVENT_SUPPORT'])
    expect(volunteer.certifications.map(c => c.certification)).toEqual(['DOULA_CERTIFICATION'])
    expect(volunteer.availabilities.map(a => a.availability)).toEqual(['WEEKEND_MORNING'])

    const application = await prisma.volunteer_Application.findFirst()
    expect(application!.volunteerId).toBe(volunteer.id)
    expect(application!.source).toBe('MONDAY_CSV')
    expect(application!.importedByUserId).toBe('admin-user')
    // 6:02 PM Central on 21 Jan 2025, not 18:02 UTC — the whole reason the
    // submission date is parsed rather than handed to `new Date()`.
    expect(application!.submittedAt.toISOString()).toBe('2025-01-22T00:02:00.000Z')
    expect(application!.signatureURL).toBe('https://example.test/sig.png')
    expect(JSON.parse(application!.rawRow)['First Name']).toBe('Rosa')
  })

  it('approves someone whose submission reports a training', async () => {
    await run(csv(ROSA_AGAIN), true)
    const volunteer = await prisma.volunteer.findFirst()
    expect(volunteer!.approvalStatus).toBe('APPROVED')
  })

  it('collapses repeat submissions into one volunteer and keeps both rows', async () => {
    await run(csv(ROSA, ROSA_AGAIN), true)

    expect(await prisma.user.count()).toBe(1)
    expect(await prisma.volunteer.count()).toBe(1)
    expect(await prisma.volunteer_Application.count()).toBe(2)

    const volunteer = await prisma.volunteer.findFirstOrThrow({ include: { volunteerAreas: true } })
    // The later submission is the one the profile follows.
    expect(volunteer.approvalStatus).toBe('APPROVED')
    expect(volunteer.volunteerAreas.map(a => a.volunteerArea)).toEqual(['COMMUNITY_OUTREACH'])
  })

  it('is a no-op when the same file is imported twice', async () => {
    await run(csv(ROSA, ROSA_AGAIN, MARCUS), true)
    const second = await run(csv(ROSA, ROSA_AGAIN, MARCUS), true)

    expect(second.summary.newSubmissions).toBe(0)
    expect(second.summary.alreadyImported).toBe(2)
    expect(second.summary.failed).toBe(0)
    expect(await prisma.user.count()).toBe(2)
    expect(await prisma.volunteer.count()).toBe(2)
    expect(await prisma.volunteer_Application.count()).toBe(3)
    // Re-granting a role must upsert, not insert — the composite key would
    // otherwise make the second run fail for everyone in the file.
    expect(await prisma.user_Role.count()).toBe(4)
  })

  it('adds only the submissions a later export has gained', async () => {
    await run(csv(ROSA), true)
    const second = await run(csv(ROSA, ROSA_AGAIN), true)

    expect(second.summary.newSubmissions).toBe(1)
    expect(await prisma.volunteer_Application.count()).toBe(2)
  })
})

describe('existing records', () => {
  it('leaves an existing volunteer profile exactly as it is', async () => {
    const existing = await createVolunteer({ name: 'Rosa Delgado', email: 'rosa.delgado@example.test' })
    await prisma.volunteer.update({
      where: { id: existing.id },
      data: { gender: 'OTHER', emergencyContactName1: 'Corrected By Staff' },
    })

    const result = await run(csv(ROSA), true)

    expect(result.applicants[0]!.action).toBe('KEEP_EXISTING_VOLUNTEER')
    const volunteer = await prisma.volunteer.findUniqueOrThrow({ where: { id: existing.id } })
    expect(volunteer.gender).toBe('OTHER')
    expect(volunteer.emergencyContactName1).toBe('Corrected By Staff')
    // The submission is still recorded against them.
    const application = await prisma.volunteer_Application.findFirstOrThrow()
    expect(application.volunteerId).toBe(existing.id)
  })

  it('fills only the blanks on an account that already exists', async () => {
    await prisma.user.create({ data: { email: 'rosa.delgado@example.test', name: 'R. Delgado' } })

    const result = await run(csv(ROSA), true)

    expect(result.applicants[0]!.action).toBe('LINK_EXISTING_USER')
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'rosa.delgado@example.test' } })
    expect(user.name).toBe('R. Delgado')
    // Phone was empty, so the import supplies it.
    expect(user.phone).toBe('469-432-9400')
    expect(await prisma.volunteer.count()).toBe(1)
  })
})

describe('rejections and reporting', () => {
  it('imports the good rows and reports the bad one', async () => {
    const noEmail = row(['Nobody', 'Here', '', '', '', '', '', '', '', '', '', '', '', '', 'Jan 1, 2025 9:00 AM'])
    const result = await run(csv(ROSA, noEmail), true)

    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0]!.errors[0]).toContain('No email address')
    expect(await prisma.volunteer.count()).toBe(1)
  })

  it('surfaces an answer that mapped to OTHER so it can be checked', async () => {
    const result = await run(csv(MARCUS), false)
    const marcus = result.applicants.find(a => a.email === 'marcus@example.test')!
    expect(marcus.warnings.join(' ')).toContain('Dallas')
  })

  it('refuses an empty body and a file with no records', async () => {
    await expect(run('', false)).rejects.toMatchObject({ statusCode: 400 })
    await expect(run(HEADERS, false)).rejects.toMatchObject({ statusCode: 400 })
  })
})
