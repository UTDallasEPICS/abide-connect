/**
 * One-time bulk import of volunteer records, for the switchover from Abide's
 * previous system onto this platform.
 *
 * Run it against a *copy* of the database, read the report, fix the source
 * data, run it again. Only when a dry run is clean does `--commit` touch
 * anything. It lives in `scripts/` rather than `server/utils/` on purpose:
 * Nitro auto-imports `server/utils`, and a bulk writer of `User` rows has no
 * business being reachable from application code.
 *
 *   pnpm tsx scripts/import/importVolunteers.ts --file ./volunteers.json
 *   pnpm tsx scripts/import/importVolunteers.ts --file ./volunteers.json --commit
 *
 * `DATABASE_URL` selects the database, exactly as it does for the app.
 *
 * Why a script and not an admin screen: creating a `User` row *is* creating a
 * sign-in-able account. The app's security model rests on accounts only coming
 * into existence through a verified OTP round trip (`disableSignUp: true` on
 * the emailOTP plugin), and this bypasses that entirely. That power belongs in
 * a developer's hands for one afternoon, not in a permanent staff-facing
 * feature. Delete the source data file when the migration is done.
 *
 * Three properties it is built around:
 *
 *   Re-runnable. Ids are derived from the source system's own key
 *   (`stableUuid`), join rows are added but never removed, and hour logs are
 *   matched on their content before insert. Running twice imports once.
 *
 *   All-or-nothing. Every write happens in a single transaction, so a row that
 *   fails halfway through the file doesn't leave a half-migrated database
 *   behind — which matters more than usual here, because the store is a single
 *   SQLite file with no point-in-time restore.
 *
 *   Loud before it is destructive. Validation runs over the whole file first
 *   and reports *every* problem at once, rather than dying on the first one.
 *   The failure mode this is guarding against is a silent one: a mis-cased
 *   email produces an account that can never sign in, and the user-visible
 *   symptom is "Invalid or expired code", which looks like a mail problem.
 */
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { PrismaClient } from '../../server/utils/generated/prisma/client.ts'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { parseZonedDate } from '../../shared/utils/eventTime'
import type { SourceVolunteer } from './types.ts'
import {
  createUnmappedReport,
  mapEnum,
  mapEnumList,
  type UnmappedReport,
} from './mapping.ts'

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>

// ---------------------------------------------------------------- identity --

/**
 * A deterministic UUID for a source record, so re-running updates rows instead
 * of creating a second set of them.
 *
 * `Volunteer.id` and `User.id` both default to `uuid()`, which is random — fine
 * when a person signs themselves up, useless for an import that has to be safe
 * to run twice. Hashing the source system's own key gives an id that is stable
 * across runs, and namespacing it keeps a volunteer's id distinct from the id
 * of the user it hangs off. Formatted as a v5 UUID purely so the values look
 * like every other id in the table.
 */
function stableUuid(namespace: 'user' | 'volunteer', legacyId: string): string {
  const bytes = createHash('sha1').update(`abide:${namespace}:${legacyId}`).digest().subarray(0, 16)
  const b = Buffer.from(bytes)
  b[6] = (b[6]! & 0x0f) | 0x50
  b[8] = (b[8]! & 0x3f) | 0x80
  const hex = b.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Trimmed and lower-cased, matching `server/utils/normalizeEmail.ts`.
 *
 * Duplicated rather than imported because that module lives under `server/`,
 * and this script deliberately does not depend on the app's server tree. The
 * rule it encodes is not cosmetic: Better Auth lower-cases addresses before
 * looking users up, `users.email` has no `COLLATE NOCASE`, and SQLite's `=` is
 * case-sensitive — so a row stored as `Casey@Example.com` is invisible to every
 * sign-in attempt, forever.
 */
function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

// -------------------------------------------------------------- validation --

interface Problem {
  legacyId: string
  field: string
  detail: string
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Checks the whole file and returns everything wrong with it.
 *
 * Deliberately exhaustive rather than fail-fast: the point of a dry run is to
 * produce one list to take back to Abide, not to surface one bad row per
 * iteration.
 */
function validate(records: SourceVolunteer[], unmapped: UnmappedReport): Problem[] {
  const problems: Problem[] = []
  const seenLegacyIds = new Map<string, number>()
  const seenEmails = new Map<string, string>()

  records.forEach((record, index) => {
    const legacyId = record.legacyId ?? `<row ${index + 1}>`

    if (!record.legacyId) {
      problems.push({ legacyId, field: 'legacyId', detail: 'missing — required, and it is what makes the import re-runnable' })
    }
    else if (seenLegacyIds.has(record.legacyId)) {
      problems.push({ legacyId, field: 'legacyId', detail: `duplicated (also row ${seenLegacyIds.get(record.legacyId)! + 1})` })
    }
    else {
      seenLegacyIds.set(record.legacyId, index)
    }

    const email = normalizeEmail(record.email)
    if (!email) {
      problems.push({ legacyId, field: 'email', detail: 'missing — a volunteer with no address can never sign in' })
    }
    else if (!EMAIL_SHAPE.test(email)) {
      problems.push({ legacyId, field: 'email', detail: `not a valid address: "${record.email}"` })
    }
    else if (seenEmails.has(email)) {
      // `User.email` is @unique, so this aborts the transaction at write time.
      // Two rows for one person is the normal cause and needs a human decision
      // about which record survives.
      problems.push({ legacyId, field: 'email', detail: `duplicate of ${seenEmails.get(email)} — "${email}"` })
    }
    else {
      seenEmails.set(email, legacyId)
    }

    // Populates the unmapped report as a side effect; the return values are
    // recomputed at write time.
    mapEnum('gender', record.gender, unmapped)
    mapEnum('ethnicity', record.ethnicity, unmapped)
    mapEnumList('language', record.languages, unmapped)
    mapEnumList('availability', record.availabilities, unmapped)
    mapEnumList('volunteerArea', record.volunteerAreas, unmapped)
    mapEnumList('certification', record.certifications, unmapped)

    for (const [logIndex, log] of (record.hourLogs ?? []).entries()) {
      const where = `hourLogs[${logIndex}]`
      if (!DATE_ONLY.test(String(log.date ?? ''))) {
        problems.push({ legacyId, field: where, detail: `date must be YYYY-MM-DD, got "${log.date}"` })
      }
      if (typeof log.hours !== 'number' || !Number.isFinite(log.hours) || log.hours <= 0) {
        problems.push({ legacyId, field: where, detail: `hours must be a positive number, got ${JSON.stringify(log.hours)}` })
      }
      for (const stamp of ['createdAt', 'approvedAt'] as const) {
        const value = log[stamp]
        if (value !== undefined && Number.isNaN(new Date(value).getTime())) {
          problems.push({ legacyId, field: `${where}.${stamp}`, detail: `unparseable timestamp "${value}"` })
        }
      }
      mapEnum('volunteerArea', log.program, unmapped)
    }
  })

  return problems
}

// ------------------------------------------------------------------ writes --

interface Options {
  commit: boolean
  /** Applied when a record doesn't state `isApproved` either way. */
  defaultApproval: 'APPROVED' | 'PENDING'
}

interface Totals {
  usersCreated: number
  usersMatched: number
  volunteersCreated: number
  volunteersUpdated: number
  joinRowsCreated: number
  hourLogsCreated: number
  hourLogsSkipped: number
}

/**
 * Adds only the join rows that aren't already there.
 *
 * Additive rather than replace-what's-there: a volunteer who has already signed
 * up here and edited their own languages must not have those edits reverted by
 * a re-run of the import. The composite primary keys make "already there" exact.
 */
async function addMissing<T extends string>(
  existing: readonly T[],
  wanted: readonly T[],
  create: (value: T) => Promise<unknown>,
): Promise<number> {
  const have = new Set<string>(existing)
  let created = 0
  for (const value of wanted) {
    if (have.has(value)) continue
    await create(value)
    created += 1
  }
  return created
}

async function importOne(
  tx: TxClient,
  record: SourceVolunteer,
  options: Options,
  unmapped: UnmappedReport,
  totals: Totals,
) {
  const email = normalizeEmail(record.email)

  // Match an existing account by address before falling back to a derived id.
  // Someone may already have signed themselves up here ahead of the migration,
  // and their real `User.id` has to win — inserting the derived id instead
  // would collide on the unique email and abort the whole transaction.
  const existingUser = await tx.user.findUnique({ where: { email }, select: { id: true } })
  const userId = existingUser?.id ?? stableUuid('user', record.legacyId)

  await tx.user.upsert({
    where: { id: userId },
    // Name and phone are refreshed, but nothing is nulled out: a blank column
    // in the export means "the old system didn't know", not "clear this".
    update: {
      ...(record.name ? { name: record.name } : {}),
      ...(record.phone ? { phone: record.phone } : {}),
    },
    create: {
      id: userId,
      email,
      name: record.name ?? null,
      phone: record.phone ?? null,
      // Left false. Nothing in the app gates on it, and the first OTP sign-in
      // is what actually proves the address — asserting it here would be a
      // claim this import is in no position to make.
      emailVerified: false,
    },
  })
  if (existingUser) totals.usersMatched += 1
  else totals.usersCreated += 1

  // Both roles, active. A VOLUNTEER role without a `Volunteer` row breaks every
  // `findUnique({ userId })` downstream, and a row without the role leaves the
  // volunteer unable to reach the pages it unlocks — so they are written
  // together, in the same transaction, exactly as `application.post.ts` does.
  for (const role of ['USER', 'VOLUNTEER'] as const) {
    await tx.user_Role.upsert({
      where: { userId_role: { userId, role } },
      update: { active: true },
      create: { userId, role, active: true },
    })
  }

  const existingVolunteer = await tx.volunteer.findUnique({
    where: { userId },
    select: { id: true },
  })
  const volunteerId = existingVolunteer?.id ?? stableUuid('volunteer', record.legacyId)

  // Explicit, never left to the schema default of PENDING: a migrated volunteer
  // who is already cleared must arrive cleared, or the switchover locks the
  // entire existing corps out of volunteer-only events on its first day.
  const approvalStatus = record.isApproved === undefined
    ? options.defaultApproval
    : record.isApproved ? 'APPROVED' : 'PENDING'

  const profile = {
    isActive: record.isActive ?? true,
    approvalStatus,
    gender: mapEnum('gender', record.gender, unmapped) as never,
    ethinicity: mapEnum('ethnicity', record.ethnicity, unmapped) as never,
    otherVolunteerAreaDescription: record.otherVolunteerAreaDescription ?? null,
    otherCertificationDescription: record.otherCertificationDescription ?? null,
    emergencyContactName1: record.emergencyContactName1 ?? null,
    emergencyContactPhone1: record.emergencyContactPhone1 ?? null,
    emergencyContactName2: record.emergencyContactName2 ?? null,
    emergencyContactPhone2: record.emergencyContactPhone2 ?? null,
  }

  await tx.volunteer.upsert({
    where: { id: volunteerId },
    update: profile,
    create: { id: volunteerId, userId, ...profile },
  })
  if (existingVolunteer) totals.volunteersUpdated += 1
  else totals.volunteersCreated += 1

  const [languages, availabilities, areas, certifications] = await Promise.all([
    tx.volunteer_Language.findMany({ where: { volunteerId }, select: { language: true } }),
    tx.volunteer_Availability.findMany({ where: { volunteerId }, select: { availability: true } }),
    tx.volunteer_VolunteerArea.findMany({ where: { volunteerId }, select: { volunteerArea: true } }),
    tx.volunteer_Certification.findMany({ where: { volunteerId }, select: { certification: true } }),
  ])

  totals.joinRowsCreated += await addMissing(
    languages.map(row => row.language),
    mapEnumList('language', record.languages, unmapped),
    value => tx.volunteer_Language.create({ data: { volunteerId, language: value as never } }),
  )
  totals.joinRowsCreated += await addMissing(
    availabilities.map(row => row.availability),
    mapEnumList('availability', record.availabilities, unmapped),
    value => tx.volunteer_Availability.create({ data: { volunteerId, availability: value as never } }),
  )
  totals.joinRowsCreated += await addMissing(
    areas.map(row => row.volunteerArea),
    mapEnumList('volunteerArea', record.volunteerAreas, unmapped),
    value => tx.volunteer_VolunteerArea.create({ data: { volunteerId, volunteerArea: value as never } }),
  )
  totals.joinRowsCreated += await addMissing(
    certifications.map(row => row.certification),
    mapEnumList('certification', record.certifications, unmapped),
    value => tx.volunteer_Certification.create({ data: { volunteerId, certification: value as never } }),
  )

  for (const log of record.hourLogs ?? []) {
    // `Volunteer_Hour_Log.id` is an autoincrementing Int, so unlike every other
    // table here there is no natural key to upsert on and a re-run would happily
    // insert the same history twice. Matching on the content instead is the only
    // handle available. Two genuinely distinct shifts of identical length on the
    // same day for the same description do collapse into one — an acceptable
    // trade against silently doubling a volunteer's lifetime hours, which feeds
    // the funder report.
    const date = parseZonedDate(log.date)
    const eventName = log.eventName ?? null

    const duplicate = await tx.volunteer_Hour_Log.findFirst({
      where: { volunteerId, date, hours: log.hours, eventName },
      select: { id: true },
    })
    if (duplicate) {
      totals.hourLogsSkipped += 1
      continue
    }

    await tx.volunteer_Hour_Log.create({
      data: {
        volunteerId,
        eventId: null,
        eventName,
        // Read as a calendar date in Central, not UTC. `new Date('2025-03-01')`
        // is 6pm on Feb 28 here, which lands the entry in the wrong month of
        // every report that buckets by month — the bug the
        // `date_only_columns_in_org_timezone` migration exists to undo.
        date,
        hours: log.hours,
        // Historical hours arrive already reviewed; leaving them PENDING would
        // drop a migrated corps' entire history into the approval queue and
        // exclude it from the reports until someone clicked through all of it.
        approvalStatus: 'APPROVED',
        program: mapEnum('volunteerArea', log.program, unmapped) as never,
        comment: log.comment ?? null,
        // Backdated so approval latency stays meaningful. Falling back to the
        // work date rather than now() keeps `approvedAt - createdAt` at zero
        // for migrated rows instead of making it years wide.
        createdAt: log.createdAt ? new Date(log.createdAt) : date,
        approvedAt: log.approvedAt ? new Date(log.approvedAt) : date,
      },
    })
    totals.hourLogsCreated += 1
  }
}

// --------------------------------------------------------------------- cli --

function parseArgs(argv: string[]) {
  const file = argv[argv.indexOf('--file') + 1]
  const approvalFlag = argv.includes('--default-approval')
    ? argv[argv.indexOf('--default-approval') + 1]
    : 'APPROVED'

  if (!argv.includes('--file') || !file || file.startsWith('--')) {
    throw new Error('Usage: tsx scripts/import/importVolunteers.ts --file <path.json> [--commit] [--default-approval APPROVED|PENDING]')
  }
  if (approvalFlag !== 'APPROVED' && approvalFlag !== 'PENDING') {
    throw new Error(`--default-approval must be APPROVED or PENDING, got "${approvalFlag}"`)
  }

  return {
    file,
    options: { commit: argv.includes('--commit'), defaultApproval: approvalFlag } satisfies Options,
  }
}

function reportUnmapped(unmapped: UnmappedReport) {
  if (!unmapped.size) return
  console.log('\nUnmapped values (add an alias in mapping.ts, or confirm with Abide that they should be dropped):')
  for (const [field, values] of unmapped) {
    console.log(`  ${field}`)
    for (const [value, count] of [...values].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(count).padStart(5)}x  ${value}`)
    }
  }
}

async function main() {
  const { file, options } = parseArgs(process.argv.slice(2))

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Point it at a *copy* of the database first.')
  }

  const records: SourceVolunteer[] = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!Array.isArray(records)) throw new Error(`${file} must contain a JSON array of SourceVolunteer`)

  console.log(`Read ${records.length} record(s) from ${file}`)
  console.log(`Database: ${process.env.DATABASE_URL}`)
  console.log(options.commit ? 'Mode: COMMIT — this will write.\n' : 'Mode: DRY RUN — nothing will be written.\n')

  const unmapped = createUnmappedReport()
  const problems = validate(records, unmapped)

  if (problems.length) {
    console.error(`${problems.length} problem(s) found:`)
    for (const problem of problems) {
      console.error(`  [${problem.legacyId}] ${problem.field}: ${problem.detail}`)
    }
    reportUnmapped(unmapped)
    console.error('\nRefusing to continue. Fix the source data and re-run.')
    process.exitCode = 1
    return
  }

  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  const totals: Totals = {
    usersCreated: 0, usersMatched: 0,
    volunteersCreated: 0, volunteersUpdated: 0,
    joinRowsCreated: 0, hourLogsCreated: 0, hourLogsSkipped: 0,
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const record of records) {
        await importOne(tx as TxClient, record, options, unmapped, totals)
      }

      if (!options.commit) {
        // A dry run does the real work and then throws it away, so the report
        // reflects what would actually happen — including collisions with rows
        // already in the database, which no amount of static checking would find.
        throw new DryRun()
      }
    }, {
      // The defaults (5s) are sized for request handlers, not for a few
      // thousand sequential upserts.
      timeout: 15 * 60 * 1000,
      maxWait: 60 * 1000,
    })
  }
  catch (error) {
    if (!(error instanceof DryRun)) throw error
  }

  reportUnmapped(unmapped)
  console.log('\nSummary:')
  console.log(`  users:       ${totals.usersCreated} created, ${totals.usersMatched} matched to existing accounts`)
  console.log(`  volunteers:  ${totals.volunteersCreated} created, ${totals.volunteersUpdated} updated`)
  console.log(`  join rows:   ${totals.joinRowsCreated} created`)
  console.log(`  hour logs:   ${totals.hourLogsCreated} created, ${totals.hourLogsSkipped} already present`)
  console.log(options.commit ? '\nCommitted.' : '\nRolled back (dry run). Re-run with --commit to apply.')

  await prisma.$disconnect()
}

/** Sentinel used to roll a dry run back; not an error condition. */
class DryRun extends Error {}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
