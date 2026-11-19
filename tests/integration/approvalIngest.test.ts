import { randomUUID } from 'node:crypto'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import prisma from '#server/utils/prisma'
import { createVolunteer, resetDatabase } from '../setup/fixtures'
import { createFakeEvent } from '../setup/h3-globals'

/**
 * Batch approval's write path, against the real schema.
 *
 * Approving is what opens volunteer-only events to someone, and this does it
 * for a whole file at once, so the properties worth pinning are the ones about
 * what it leaves alone: a preview changes nobody, people not on the list are
 * untouched, nothing is created for an address it can't match, and it can only
 * ever move someone *to* approved.
 */
vi.mock('#server/utils/requireRole', () => ({
  requireRole: vi.fn(async () => ({ user: { id: 'admin-user' }, session: {} })),
}))

const { default: ingest } = await import('#server/api/admin/ingest/approvals.post')

interface Result {
  mode: string
  totalRows: number
  duplicateRows: number
  summary: Record<string, number>
  people: { email: string, action: string, currentStatus: string | null, accountName: string | null, warnings: string[] }[]
}

const run = (text: string, commit: boolean) =>
  (ingest as (e: ReturnType<typeof createFakeEvent>) => Promise<Result>)(
    createFakeEvent({ body: { csv: text, commit } }),
  )

const csv = (...rows: string[]) => ['Name,Email', ...rows].join('\n')

const statusOf = async (email: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { email }, include: { volunteer: true } })).volunteer?.approvalStatus

beforeEach(async () => {
  await resetDatabase()

  await createVolunteer({ name: 'Rosa Delgado', email: 'rosa@example.test', approvalStatus: 'PENDING' })
  await createVolunteer({ name: 'Marcus Obi', email: 'marcus@example.test', approvalStatus: 'PENDING' })
  await createVolunteer({ name: 'Dana Reyes', email: 'dana@example.test', approvalStatus: 'APPROVED' })
  await createVolunteer({ name: 'Sam Ito', email: 'sam@example.test', approvalStatus: 'REJECTED' })
  // An account that never applied to volunteer.
  await prisma.user.create({ data: { id: randomUUID(), name: 'Guest Gia', email: 'gia@example.test' } })
})

afterAll(async () => {
  await resetDatabase()
})

describe('preview', () => {
  it('reports what it would do and changes nobody', async () => {
    const result = await run(csv('Rosa Delgado,rosa@example.test', 'Dana Reyes,dana@example.test'), false)

    expect(result.mode).toBe('preview')
    expect(result.summary.approve).toBe(1)
    expect(result.summary.alreadyApproved).toBe(1)
    expect(await statusOf('rosa@example.test')).toBe('PENDING')
  })
})

describe('commit', () => {
  it('approves the people on the list and nobody else', async () => {
    const result = await run(csv('Rosa Delgado,Rosa@Example.test'), true)

    expect(result.people[0]).toMatchObject({ action: 'APPROVE', currentStatus: 'PENDING', accountName: 'Rosa Delgado' })
    expect(await statusOf('rosa@example.test')).toBe('APPROVED')
    // Pending, and not on the list.
    expect(await statusOf('marcus@example.test')).toBe('PENDING')
  })

  it('is a no-op when the same file is run again', async () => {
    await run(csv('Rosa Delgado,rosa@example.test'), true)
    const again = await run(csv('Rosa Delgado,rosa@example.test'), true)

    expect(again.summary.approve).toBe(0)
    expect(again.summary.alreadyApproved).toBe(1)
    expect(await statusOf('rosa@example.test')).toBe('APPROVED')
  })

  it('approves a previously rejected volunteer, and flags it', async () => {
    const result = await run(csv('Sam Ito,sam@example.test'), true)

    expect(result.people[0]!.action).toBe('APPROVE')
    expect(result.people[0]!.warnings).toEqual(['Previously rejected — this will approve them.'])
    expect(await statusOf('sam@example.test')).toBe('APPROVED')
  })

  it('creates nothing for an address with no account or no application', async () => {
    const usersBefore = await prisma.user.count()
    const volunteersBefore = await prisma.volunteer.count()

    const result = await run(csv('Nobody,nobody@example.test', 'Guest Gia,gia@example.test'), true)

    expect(result.people.map(p => p.action)).toEqual(['NOT_FOUND', 'NO_VOLUNTEER_PROFILE'])
    expect(result.summary).toMatchObject({ approve: 0, notFound: 1, noVolunteerProfile: 1 })
    expect(await prisma.user.count()).toBe(usersBefore)
    expect(await prisma.volunteer.count()).toBe(volunteersBefore)
  })

  it('flags a name that does not match the account the email belongs to', async () => {
    // Marcus's address typed against Rosa's name: the email decides who is
    // approved, so the mismatch has to be visible before committing.
    const result = await run(csv('Rosa Delgado,marcus@example.test'), false)

    expect(result.people[0]!.warnings).toEqual([
      'Listed as "Rosa Delgado", but this account belongs to "Marcus Obi".',
    ])
    expect(result.summary.withWarnings).toBe(1)
  })

  it('counts a repeated person once', async () => {
    const result = await run(csv('Rosa Delgado,rosa@example.test', 'Rosa Delgado,ROSA@example.test'), true)

    expect(result.totalRows).toBe(2)
    expect(result.duplicateRows).toBe(1)
    expect(result.summary.approve).toBe(1)
  })

  it('reads a list saved with a title line above the header', async () => {
    const result = await run('Training cohort Nov 2026,\nName,Email\nRosa Delgado,rosa@example.test', true)

    expect(result.summary.approve).toBe(1)
    expect(await statusOf('rosa@example.test')).toBe('APPROVED')
  })
})

describe('validation', () => {
  it('rejects a header with no records under it', async () => {
    await expect(run('Name,Email\n', false)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects a file with no email column', async () => {
    await expect(run('Name,Phone\nRosa,555-0100', false)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects an empty upload', async () => {
    await expect(run('  ', false)).rejects.toMatchObject({ statusCode: 400 })
  })
})
