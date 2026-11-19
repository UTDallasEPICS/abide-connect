import { describe, it, expect } from 'vitest'
import { parseCsvRows } from '#server/utils/csv'
import { findApprovalHeaderRow, planApprovalImport, resolveApprovalColumns, sameName } from '#server/utils/approvalImport'

/**
 * Reading a "passed training" list.
 *
 * The file is hand-assembled by staff, so the cases are the ways such a list
 * actually varies: which columns it has, how addresses are capitalised, people
 * appearing twice, and cells that aren't an address at all.
 */

const plan = (text: string) => planApprovalImport(parseCsvRows(text))

describe('resolveApprovalColumns', () => {
  it('finds the columns of the volunteer application export', () => {
    expect(resolveApprovalColumns(['First Name', 'Last Name', 'Phone Number', 'Email Address'])).toEqual({
      email: 'Email Address',
      firstName: 'First Name',
      lastName: 'Last Name',
      name: undefined,
    })
  })

  it('prefers the volunteer\'s own email over another column that mentions one', () => {
    const columns = resolveApprovalColumns(['Name', 'Emergency Contact Email', 'Email'])
    expect(columns.email).toBe('Email')
    expect(columns.name).toBe('Name')
  })

  it('does not take an emergency contact for the volunteer\'s name', () => {
    expect(resolveApprovalColumns(['Email', 'Emergency Contact Name']).name).toBeUndefined()
  })
})

describe('planApprovalImport', () => {
  it('normalises addresses so they compare equal to stored ones', () => {
    const result = plan('Name,Email\nRosa Delgado,  Rosa.Delgado@Example.test ')

    expect(result.people).toEqual([
      { rowNumber: 2, email: 'rosa.delgado@example.test', name: 'Rosa Delgado' },
    ])
  })

  it('joins a first and last name pair', () => {
    const result = plan('First Name,Last Name,Email Address\nMarcus,Obi,marcus@example.test')
    expect(result.people[0]!.name).toBe('Marcus Obi')
  })

  it('works from a bare column of addresses', () => {
    const result = plan('email\na@example.test\nb@example.test')

    expect(result.people.map(p => p.email)).toEqual(['a@example.test', 'b@example.test'])
    expect(result.people.map(p => p.name)).toEqual([null, null])
  })

  it('counts someone listed twice once', () => {
    const result = plan('Email\na@example.test\nA@Example.test\nb@example.test')

    expect(result.totalRows).toBe(3)
    expect(result.people.map(p => p.email)).toEqual(['a@example.test', 'b@example.test'])
    expect(result.duplicateRows).toBe(1)
  })

  it('rejects rows with no usable address, by file line', () => {
    const result = plan('Name,Email\nNo Address,\nTypo,rosa.example.test\nFine,fine@example.test')

    expect(result.people.map(p => p.email)).toEqual(['fine@example.test'])
    expect(result.rejected).toEqual([
      { rowNumber: 2, email: '', errors: ['No email address.'] },
      { rowNumber: 3, email: 'rosa.example.test', errors: ['Not an email address.'] },
    ])
  })

  it('says so when the file has no email column at all', () => {
    expect(plan('Name,Phone\nRosa,555-0100').hasEmailColumn).toBe(false)
  })

  it('reads past a title line above the header, keeping file line numbers', () => {
    const result = plan('Training cohort Nov 2026,,\n,,\nFull Name,Emergency Contact Email,Email Address\nRosa Delgado,mom@example.test,rosa@example.test\n,,\nDana Reyes,,')

    expect(result.hasEmailColumn).toBe(true)
    expect(result.totalRows).toBe(2)
    expect(result.people).toEqual([{ rowNumber: 4, email: 'rosa@example.test', name: 'Rosa Delgado' }])
    expect(result.rejected).toEqual([{ rowNumber: 6, email: '', errors: ['No email address.'] }])
  })
})

describe('findApprovalHeaderRow', () => {
  it('is the first row when the file starts with its header', () => {
    expect(findApprovalHeaderRow([['Name', 'Email'], ['Rosa', 'rosa@example.test']])).toBe(0)
  })

  it('steps over a one-cell title that mentions email', () => {
    expect(findApprovalHeaderRow([['Emails of everyone who passed'], ['Name', 'Email'], ['Rosa', 'r@example.test']])).toBe(1)
  })

  it('accepts a bare one-column list headed "Email"', () => {
    expect(findApprovalHeaderRow([['Email'], ['a@example.test']])).toBe(0)
  })

  it('reports -1 when no row has an email column', () => {
    expect(findApprovalHeaderRow([['Name', 'Phone'], ['Rosa', '555-0100']])).toBe(-1)
  })
})

describe('sameName', () => {
  it('ignores case and spacing, and nothing else', () => {
    expect(sameName('ROSA  delgado', 'Rosa Delgado')).toBe(true)
    expect(sameName('Rosa Delgado', 'Rosa Delgado-Reyes')).toBe(false)
  })
})
