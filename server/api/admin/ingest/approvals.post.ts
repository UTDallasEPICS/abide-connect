import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'
import { parseCsvRows } from '#server/utils/csv'
import { planApprovalImport, sameName } from '#server/utils/approvalImport'

/**
 * Approves, in one go, the volunteers named in a CSV of people who passed
 * training. Admin only, and not linked from anywhere in the app — see
 * `app/pages/ingest/approvals.vue`.
 *
 * The bulk counterpart of `volunteer/[id]/approval.patch.ts`, built the way the
 * volunteer importer next to it is: two modes over one code path. Without
 * `commit` it matches the file against the database and reports what it *would*
 * do, touching nothing; with `commit` it does that. The preview an admin reads
 * is therefore the approval that runs.
 *
 * What it will and won't do:
 *
 * - It matches on email only, against `User.email`. A name in the file is shown
 *   and compared, never used to find anyone.
 * - It only ever moves a volunteer *to* APPROVED. Someone already approved is
 *   left alone, so re-running a file is a no-op, and nothing here can reject or
 *   un-approve.
 * - A previously REJECTED volunteer on the list is approved — a rejection is
 *   not a ban, and attending another training is how it gets reconsidered —
 *   but the row is flagged so staff see it before committing.
 * - It never creates anything. An address with no account, or an account that
 *   never applied to volunteer, is reported and skipped; those people go
 *   through the application (or the application importer) first.
 */

/** Refuse anything implausible for a list of names before parsing it. */
const MAX_CSV_BYTES = 2 * 1024 * 1024

/**
 * What the batch would do, or did, for one person.
 *
 * - `APPROVE` — a pending or rejected volunteer, moved to APPROVED.
 * - `ALREADY_APPROVED` — nothing to do.
 * - `NO_VOLUNTEER_PROFILE` — the account exists but never applied.
 * - `NOT_FOUND` — no account has this address.
 */
type ApprovalAction = 'APPROVE' | 'ALREADY_APPROVED' | 'NO_VOLUNTEER_PROFILE' | 'NOT_FOUND'

interface ApprovalReport {
  rowNumber: number
  email: string
  /** As written in the file. */
  listedName: string | null
  /** The name on the account it matched, when there is one. */
  accountName: string | null
  action: ApprovalAction
  /** Status before this run; null when there is no volunteer profile. */
  currentStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  warnings: string[]
  /** Set only on a commit that failed for this person; the rest still ran. */
  error?: string
}

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const body = await readBody<{ csv?: unknown, commit?: unknown }>(event)
  const csv = typeof body?.csv === 'string' ? body.csv : ''
  const commit = body?.commit === true

  if (!csv.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'No CSV content was sent.' })
  }
  if (Buffer.byteLength(csv, 'utf8') > MAX_CSV_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'That file is larger than this importer accepts (2 MB).' })
  }

  const plan = planApprovalImport(parseCsvRows(csv))
  if (!plan.hasEmailColumn) {
    throw createError({ statusCode: 400, statusMessage: 'No email column found — volunteers are matched by email address.' })
  }
  if (plan.totalRows === 0) {
    throw createError({ statusCode: 400, statusMessage: 'The file has a header row but no records.' })
  }

  // One round-trip rather than a lookup per person; this endpoint is also the
  // preview.
  const users = await prisma.user.findMany({
    where: { email: { in: plan.people.map(p => p.email) } },
    select: {
      email: true,
      name: true,
      volunteer: { select: { id: true, approvalStatus: true, isActive: true } },
    },
  })
  const userByEmail = new Map(users.map(u => [u.email, u]))

  const reports: ApprovalReport[] = []

  for (const person of plan.people) {
    const user = userByEmail.get(person.email)
    const volunteer = user?.volunteer ?? null

    const action: ApprovalAction
      = !user
        ? 'NOT_FOUND'
        : !volunteer
            ? 'NO_VOLUNTEER_PROFILE'
            : volunteer.approvalStatus === 'APPROVED'
              ? 'ALREADY_APPROVED'
              : 'APPROVE'

    const warnings: string[] = []
    if (user?.name && person.name && !sameName(user.name, person.name)) {
      warnings.push(`Listed as "${person.name}", but this account belongs to "${user.name}".`)
    }
    if (action === 'APPROVE' && volunteer!.approvalStatus === 'REJECTED') {
      warnings.push('Previously rejected — this will approve them.')
    }
    if (action === 'APPROVE' && !volunteer!.isActive) {
      warnings.push('This volunteer profile is inactive, so they still cannot claim shifts.')
    }

    const report: ApprovalReport = {
      rowNumber: person.rowNumber,
      email: person.email,
      listedName: person.name,
      accountName: user?.name ?? null,
      action,
      currentStatus: volunteer?.approvalStatus ?? null,
      warnings,
    }

    if (commit && action === 'APPROVE') {
      try {
        // Each person is their own statement, so one failure is reported on
        // its own and the rest of the list is still approved.
        await prisma.volunteer.update({
          where: { id: volunteer!.id },
          data: { approvalStatus: 'APPROVED' },
        })
      }
      catch (error) {
        report.error = error instanceof Error ? error.message : String(error)
        console.error('[ingest] approval failed for', person.email, error)
      }
    }

    reports.push(report)
  }

  const counted = (action: ApprovalAction) => reports.filter(r => r.action === action).length

  return {
    mode: commit ? 'commit' : 'preview',
    totalRows: plan.totalRows,
    duplicateRows: plan.duplicateRows,
    rejected: plan.rejected,
    summary: {
      people: reports.length,
      approve: counted('APPROVE'),
      alreadyApproved: counted('ALREADY_APPROVED'),
      noVolunteerProfile: counted('NO_VOLUNTEER_PROFILE'),
      notFound: counted('NOT_FOUND'),
      withWarnings: reports.filter(r => r.warnings.length > 0).length,
      failed: reports.filter(r => r.error).length,
    },
    people: reports,
  }
})
