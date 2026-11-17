/**
 * Turns a list of volunteers who passed training into the set of people to
 * approve.
 *
 * Pure, like `volunteerImport.ts`: rows in, a plan out, nothing touching the
 * database, so `/api/admin/ingest/approvals` runs the same code for the preview
 * and for the commit.
 *
 * The file is whatever staff have to hand — a sign-in sheet typed up, a Monday
 * export, a column pasted out of a spreadsheet — so the only thing it has to
 * contain is an email column. That is the one field that identifies an account
 * here (`User.email` is unique); a name is read when present, but only so the
 * preview can show it beside the account it matched and flag a mismatch. It is
 * never used to find anyone: two volunteers can share a name, and approving the
 * wrong one hands them every volunteer-only event.
 */
import { normalizeEmail } from '#server/utils/normalizeEmail'

/** Lower-cased, whitespace-collapsed, for matching a header by keyword. */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, ' ').trim()
}

export interface ApprovalColumns {
  email?: string
  /** A single full-name column… */
  name?: string
  /** …or the pair the volunteer application export uses. */
  firstName?: string
  lastName?: string
}

export function resolveApprovalColumns(headers: string[]): ApprovalColumns {
  const normalized = headers.map(h => ({ header: h, key: normalizeHeader(h) }))
  const find = (test: (key: string) => boolean) => normalized.find(h => test(h.key))?.header

  return {
    // The plainly named column first, so "Emergency contact email" earlier in
    // the sheet can't be taken for the volunteer's own address.
    email: find(k => k === 'email' || k === 'email address' || k === 'e-mail')
      ?? find(k => k.includes('email') || k.includes('e-mail')),
    firstName: find(k => k.includes('first name')),
    lastName: find(k => k.includes('last name')),
    // Exact names only: a keyword match on "name" would pick up "emergency
    // contact name", which is somebody else entirely.
    name: find(k => k === 'name' || k === 'full name' || k === 'volunteer' || k === 'volunteer name'),
  }
}

/** Good enough to tell an address from a stray cell; the account lookup is the real check. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface PlannedApproval {
  /** 1-based line in the file, for pointing the admin at the source row. */
  rowNumber: number
  /** Normalised, so it compares equal to `User.email`. */
  email: string
  /** As written in the file, or null when it has no name column. */
  name: string | null
}

export interface RejectedApprovalRow {
  rowNumber: number
  email: string
  errors: string[]
}

export interface ApprovalImportPlan {
  totalRows: number
  /** False when no column looks like an email — nothing can be matched. */
  hasEmailColumn: boolean
  people: PlannedApproval[]
  rejected: RejectedApprovalRow[]
  /** Rows repeating an address already seen; folded into the first. */
  duplicateRows: number
}

/**
 * Plans a batch approval from parsed CSV records (see `parseCsv`).
 *
 * The same person listed twice is one approval, not an error — a list built
 * from several training sessions' sheets will repeat people.
 */
export function planApprovalImport(records: Record<string, string>[], headers: string[]): ApprovalImportPlan {
  const columns = resolveApprovalColumns(headers)
  const read = (record: Record<string, string>, header: string | undefined) =>
    header ? (record[header] ?? '').trim() : ''

  const plan: ApprovalImportPlan = {
    totalRows: records.length,
    hasEmailColumn: columns.email !== undefined,
    people: [],
    rejected: [],
    duplicateRows: 0,
  }

  const seen = new Set<string>()

  records.forEach((record, index) => {
    // +2: one for the header row, one because rows are counted from 1.
    const rowNumber = index + 2
    const rawEmail = read(record, columns.email)
    const email = normalizeEmail(rawEmail)

    if (!email) {
      plan.rejected.push({ rowNumber, email: '', errors: ['No email address.'] })
      return
    }
    if (!EMAIL_PATTERN.test(email)) {
      plan.rejected.push({ rowNumber, email: rawEmail, errors: ['Not an email address.'] })
      return
    }
    if (seen.has(email)) {
      plan.duplicateRows += 1
      return
    }
    seen.add(email)

    const name = read(record, columns.name)
      || [read(record, columns.firstName), read(record, columns.lastName)].filter(Boolean).join(' ')

    plan.people.push({ rowNumber, email, name: name || null })
  })

  return plan
}

/** Case- and spacing-insensitive, so "ROSA  delgado" and "Rosa Delgado" agree. */
export function sameName(a: string, b: string): boolean {
  const fold = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()
  return fold(a) === fold(b)
}
