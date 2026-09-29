import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'
import { parseCsv } from '#server/utils/csv'
import { planImport } from '#server/utils/volunteerImport'
import type { PlannedApplicant } from '#server/utils/volunteerImport'

/**
 * Imports a volunteer-application CSV export. Admin only, and not linked from
 * anywhere in the app — see `app/pages/ingest.vue`.
 *
 * Two modes over one code path: without `commit` it parses, plans and reports
 * what it *would* do, touching nothing; with `commit` it runs that same plan.
 * The preview an admin reads is therefore the import that runs, which is the
 * only way a bulk write like this is reviewable — 299 rows of free text mapped
 * onto enums will be wrong about somebody, and the place to catch that is
 * before the write.
 *
 * Re-running the same file is a no-op. A submission is identified by
 * `(email, submittedAt)`, so rows already present are counted as
 * "already imported" rather than inserted again, and an import interrupted
 * halfway can simply be run again.
 *
 * What it will not do is overwrite. An applicant who already has a `Volunteer`
 * profile keeps it — staff or the volunteer may have corrected it since, and
 * a CSV from Monday.com is not a better authority on someone's availability
 * than the volunteer is. Their submissions are still recorded against the
 * existing profile, so nothing is lost. Same for a `User` that already exists:
 * name and phone are only filled in where they were empty.
 *
 * Note what creating these rows means. Better Auth runs with
 * `disableSignUp: true`, so an email OTP only works for an address that
 * already has a `User` — importing this file provisions sign-in-capable
 * accounts for everyone in it, each holding the VOLUNTEER role. It is not a
 * passive archive.
 */

/** Refuse anything implausible for a form export before parsing it. */
const MAX_CSV_BYTES = 10 * 1024 * 1024

/**
 * What the import would do, or did, for one applicant.
 *
 * - `CREATE` — no `User` with this address: user, volunteer, roles and
 *   applications are all written.
 * - `LINK_EXISTING_USER` — the account exists but has no volunteer profile;
 *   the profile is created and the VOLUNTEER role granted.
 * - `KEEP_EXISTING_VOLUNTEER` — already a volunteer. The profile is left
 *   exactly as it is and only the submissions are recorded against it.
 * - `ALREADY_IMPORTED` — every submission from this address is already
 *   stored. Nothing to do, which is what makes re-running a file safe.
 */
type ApplicantAction = 'CREATE' | 'LINK_EXISTING_USER' | 'KEEP_EXISTING_VOLUNTEER' | 'ALREADY_IMPORTED'

interface ApplicantReport {
  email: string
  name: string | null
  phone: string | null
  action: ApplicantAction
  approvalStatus: 'PENDING' | 'APPROVED'
  /** Submissions in the file for this person. */
  submissionCount: number
  /** Of those, how many are not yet stored. */
  newSubmissionCount: number
  firstSubmittedAt: string | null
  lastSubmittedAt: string | null
  ethinicity: string | null
  ethinicityRaw: string | null
  languages: string[]
  languagesRaw: string | null
  volunteerAreas: string[]
  certifications: string[]
  availabilities: string[]
  emergencyContactName1: string | null
  emergencyContactPhone1: string | null
  warnings: string[]
  /** Set only on a commit that failed for this person; the rest still ran. */
  error?: string
}

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, 'admin')

  const body = await readBody<{ csv?: unknown, commit?: unknown }>(event)
  const csv = typeof body?.csv === 'string' ? body.csv : ''
  const commit = body?.commit === true

  if (!csv.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'No CSV content was sent.' })
  }
  if (Buffer.byteLength(csv, 'utf8') > MAX_CSV_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'That file is larger than this importer accepts (10 MB).' })
  }

  const { headers, records } = parseCsv(csv)
  if (records.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'The file has a header row but no records.' })
  }

  const plan = planImport(records, headers)
  if (!headers.some(h => h.toLowerCase().includes('email'))) {
    throw createError({ statusCode: 400, statusMessage: 'No email column found — this does not look like a volunteer application export.' })
  }

  const emails = plan.applicants.map(a => a.email)

  // One round-trip each rather than a lookup per applicant: 262 people is 262
  // sequential queries otherwise, and this endpoint is also the preview.
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true, name: true, phone: true, volunteer: { select: { id: true } } },
  })
  const userByEmail = new Map(existingUsers.map(u => [u.email, u]))

  const existingApplications = await prisma.volunteer_Application.findMany({
    where: { email: { in: emails } },
    select: { email: true, submittedAt: true },
  })
  const storedKeys = new Set(existingApplications.map(a => submissionKey(a.email, a.submittedAt)))

  const reports: ApplicantReport[] = []

  for (const applicant of plan.applicants) {
    const user = userByEmail.get(applicant.email)
    const newSubmissions = applicant.submissions.filter(
      s => !storedKeys.has(submissionKey(applicant.email, s.submittedAt!)),
    )

    const action: ApplicantAction
      = !user
        ? 'CREATE'
        : !user.volunteer
            ? 'LINK_EXISTING_USER'
            : newSubmissions.length > 0
              ? 'KEEP_EXISTING_VOLUNTEER'
              : 'ALREADY_IMPORTED'

    const report = describe(applicant, action, newSubmissions.length)

    if (commit) {
      try {
        await importApplicant(applicant, newSubmissions.map(s => s), session.user.id)
      }
      catch (error) {
        report.error = error instanceof Error ? error.message : String(error)
        console.error('[ingest] failed for', applicant.email, error)
      }
    }

    reports.push(report)
  }

  const counted = (action: ApplicantAction) => reports.filter(r => r.action === action).length

  return {
    mode: commit ? 'commit' : 'preview',
    totalRows: plan.totalRows,
    missingColumns: plan.missingColumns,
    rejected: plan.rejected.map(r => ({ rowNumber: r.rowNumber, email: r.email, errors: r.errors })),
    summary: {
      applicants: reports.length,
      create: counted('CREATE'),
      linkExistingUser: counted('LINK_EXISTING_USER'),
      keepExistingVolunteer: counted('KEEP_EXISTING_VOLUNTEER'),
      alreadyImported: counted('ALREADY_IMPORTED'),
      newSubmissions: reports.reduce((sum, r) => sum + r.newSubmissionCount, 0),
      approved: reports.filter(r => r.approvalStatus === 'APPROVED').length,
      withWarnings: reports.filter(r => r.warnings.length > 0).length,
      failed: reports.filter(r => r.error).length,
    },
    applicants: reports,
  }
})

/** The identity of one submission, matching the unique index on the table. */
function submissionKey(email: string, submittedAt: Date): string {
  return `${email}|${submittedAt.toISOString()}`
}

function describe(applicant: PlannedApplicant, action: ApplicantAction, newSubmissionCount: number): ApplicantReport {
  const dates = applicant.submissions.map(s => s.submittedAt!).sort((a, b) => a.getTime() - b.getTime())
  const warnings = [...applicant.warnings, ...applicant.submissions.flatMap(s => s.warnings)]

  return {
    email: applicant.email,
    name: applicant.name,
    phone: applicant.phone,
    action,
    approvalStatus: applicant.profile.approvalStatus,
    submissionCount: applicant.submissions.length,
    newSubmissionCount,
    firstSubmittedAt: dates[0]?.toISOString() ?? null,
    lastSubmittedAt: dates.at(-1)?.toISOString() ?? null,
    ethinicity: applicant.profile.ethinicity,
    ethinicityRaw: applicant.profile.ethinicityRaw,
    languages: applicant.profile.languages,
    languagesRaw: applicant.profile.languagesRaw,
    volunteerAreas: applicant.profile.volunteerAreas,
    certifications: applicant.profile.certifications,
    availabilities: applicant.profile.availabilities,
    emergencyContactName1: applicant.profile.emergencyContactName1,
    emergencyContactPhone1: applicant.profile.emergencyContactPhone1,
    warnings,
  }
}

/**
 * Writes one applicant: user, volunteer profile, role grants and the
 * submissions not already stored.
 *
 * A transaction per person rather than one around the whole file. SQLite holds
 * a write lock for the length of a transaction and Prisma's interactive
 * transactions time out, so a single 262-person transaction is both a long
 * lock and an all-or-nothing outcome for a job whose whole point is that the
 * operator reviews it. Per-person means a row that fails is reported on its
 * own and the rest of the file still lands; the `(email, submittedAt)` key
 * makes re-running afterwards safe.
 */
async function importApplicant(
  applicant: PlannedApplicant,
  newSubmissions: PlannedApplicant['submissions'],
  importedByUserId: string,
) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email: applicant.email },
      select: { id: true, name: true, phone: true, volunteer: { select: { id: true } } },
    })

    let userId: string

    if (!existing) {
      const created = await tx.user.create({
        data: {
          email: applicant.email,
          name: applicant.name,
          phone: applicant.phone,
          // They have never signed in here. Verification happens the first time
          // they use an OTP, which this row is what makes possible.
          emailVerified: false,
        },
        select: { id: true },
      })
      userId = created.id
    }
    else {
      userId = existing.id
      // Fill gaps only — never overwrite something the person or staff set.
      const fill: { name?: string, phone?: string } = {}
      if (!existing.name && applicant.name) fill.name = applicant.name
      if (!existing.phone && applicant.phone) fill.phone = applicant.phone
      if (Object.keys(fill).length > 0) {
        await tx.user.update({ where: { id: userId }, data: fill })
      }
    }

    for (const role of ['USER', 'VOLUNTEER'] as const) {
      await tx.user_Role.upsert({
        where: { userId_role: { userId, role } },
        create: { userId, role, active: true },
        update: { active: true },
      })
    }

    let volunteerId = existing?.volunteer?.id ?? null

    if (!volunteerId) {
      const profile = applicant.profile
      const volunteer = await tx.volunteer.create({
        data: {
          userId,
          approvalStatus: profile.approvalStatus,
          gender: profile.gender,
          ethinicity: profile.ethinicity,
          ethinicityRaw: profile.ethinicityRaw,
          languagesRaw: profile.languagesRaw,
          otherVolunteerAreaDescription: profile.otherVolunteerAreaDescription,
          otherCertificationDescription: profile.otherCertificationDescription,
          emergencyContactName1: profile.emergencyContactName1,
          emergencyContactPhone1: profile.emergencyContactPhone1,
          emergencyContactName2: profile.emergencyContactName2,
          emergencyContactPhone2: profile.emergencyContactPhone2,
          languages: { create: profile.languages.map(language => ({ language })) },
          availabilities: { create: profile.availabilities.map(availability => ({ availability })) },
          volunteerAreas: { create: profile.volunteerAreas.map(volunteerArea => ({ volunteerArea })) },
          certifications: { create: profile.certifications.map(certification => ({ certification })) },
        },
        select: { id: true },
      })
      volunteerId = volunteer.id
    }

    for (const submission of newSubmissions) {
      await tx.volunteer_Application.create({
        data: {
          volunteerId,
          submittedAt: submission.submittedAt!,
          source: 'MONDAY_CSV',
          firstName: submission.firstName,
          lastName: submission.lastName,
          email: submission.email,
          phone: submission.phone,
          ethinicityRaw: submission.ethinicityRaw,
          languagesRaw: submission.languagesRaw,
          emergencyContactRaw: submission.emergencyContactRaw,
          volunteeredBefore: submission.volunteeredBefore,
          attendedTraining: submission.attendedTraining,
          trainingDate: submission.trainingDate,
          preferredTrainingDate: submission.preferredTrainingDate,
          ageEligibility: submission.ageEligibility,
          healthSafety: submission.healthSafety,
          backgroundCheckConsent: submission.backgroundCheckConsent,
          ongoingEducationCommitment: submission.ongoingEducationCommitment,
          acceptanceDiscretion: submission.acceptanceDiscretion,
          missionValues: submission.missionValues,
          codeOfConductSignatureURL: submission.codeOfConductSignatureURL,
          signatureURL: submission.signatureURL,
          submissionLink: submission.submissionLink,
          rawRow: JSON.stringify(submission.rawRow),
          importedByUserId,
        },
      })
    }
  })
}
