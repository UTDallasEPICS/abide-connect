/**
 * A minimal RFC 4180 CSV reader.
 *
 * Hand-rolled rather than pulled in as a dependency because the one thing this
 * has to get right is the one thing a naive `split(',')` gets wrong, and that
 * is a short amount of code: fields in the volunteer export are quoted and
 * contain commas ("Clinic Support, Event Support"), embedded newlines (an
 * emergency contact typed on two lines) and doubled quotes. A line-based
 * splitter turns a single applicant into three malformed rows, and the failure
 * is silent — it produces records, just not the right ones.
 *
 * Deliberately not a streaming parser: an export of a few thousand
 * applications is well under a megabyte, and the importer needs the whole set
 * in memory anyway to group a person's repeat submissions.
 */

/** Strips a UTF-8 BOM, which Excel writes and which would otherwise become part of the first header's name. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
}

/**
 * Splits CSV text into rows of raw string cells.
 *
 * Handles `""` as an escaped quote inside a quoted field, and accepts CRLF,
 * LF or CR line endings (including inside a quoted field, where they are kept
 * as part of the value but normalised to `\n`).
 */
export function parseCsvRows(text: string): string[][] {
  const input = stripBom(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = 0

  // Tracks whether the current row has any content, so a trailing newline at
  // the end of the file doesn't produce a final empty record.
  let started = false

  const endField = () => {
    row.push(field)
    field = ''
    started = true
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
    started = false
  }

  while (i < input.length) {
    const char = input[i]!

    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        quoted = false
        i += 1
        continue
      }
      // A newline inside quotes belongs to the value. Normalise CRLF so a
      // field split on `\n` later behaves the same whatever wrote the file.
      if (char === '\r') {
        field += '\n'
        i += input[i + 1] === '\n' ? 2 : 1
        continue
      }
      field += char
      i += 1
      continue
    }

    if (char === '"') {
      quoted = true
      i += 1
      continue
    }
    if (char === ',') {
      endField()
      i += 1
      continue
    }
    if (char === '\r' || char === '\n') {
      endRow()
      i += char === '\r' && input[i + 1] === '\n' ? 2 : 1
      continue
    }

    field += char
    started = true
    i += 1
  }

  // Whatever is left is a final row, unless the file ended on a line break.
  if (started || field.length > 0 || row.length > 0) endRow()

  return rows
}

/**
 * The same text as records keyed by header name, plus the header list.
 *
 * Duplicate header names are not merged — the last column with a given name
 * wins, which is what a spreadsheet does. Short rows read as empty strings
 * rather than `undefined`, so callers can treat every cell as a string.
 */
export interface CsvTable {
  headers: string[]
  records: Record<string, string>[]
}

export function parseCsv(text: string): CsvTable {
  const rows = parseCsvRows(text)
  if (rows.length === 0) return { headers: [], records: [] }

  const headers = (rows[0] ?? []).map(h => h.trim())
  const records = rows.slice(1)
    // Skip blank lines: a row of one empty cell is what a stray newline leaves.
    .filter(cells => cells.some(c => c.trim() !== ''))
    .map((cells) => {
      const record: Record<string, string> = {}
      headers.forEach((header, index) => {
        record[header] = cells[index] ?? ''
      })
      return record
    })

  return { headers, records }
}
