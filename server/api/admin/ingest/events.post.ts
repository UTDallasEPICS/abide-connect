import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'
import { parseCsvRows } from '#server/utils/csv'
import { eventImportKey, planEventImport } from '#server/utils/eventImport'
import type { PlannedEvent } from '#server/utils/eventImport'
import { GEOCODE_INTERVAL_MS, geocodeLocation } from '#server/utils/geocode'
import type { GeocodedLocation } from '#server/utils/geocode'
import { eventTypeToFlags, isEventType } from '#shared/utils/eventType'
import type { EventType } from '#shared/utils/eventType'

/**
 * Imports a Monday.com events-board CSV export. Admin only, and not linked
 * from anywhere in the app — see `app/pages/ingest/events.vue`.
 *
 * Built the same way as its sibling `volunteers.post.ts`: two modes over one
 * code path. Without `commit` it parses, plans and reports what it *would* do,
 * touching nothing; with `commit` it runs that same plan, so the preview an
 * admin reads is the import that runs.
 *
 * Re-running the same file is a no-op. A board export has no stable id, so an
 * event is identified by its title and start (`eventImportKey`); rows already
 * present are counted as "already imported" rather than inserted again, and an
 * import interrupted halfway can simply be run again. It never edits an event
 * that exists — a title or time fixed in the app since the last import stays
 * fixed.
 *
 * Two things a board row may not say are filled from what the admin chose on
 * the page: the audience (`defaultEventType`) and the address
 * (`defaultLocation`). A row with no address and no default is reported and
 * skipped, because `Event.location` is a required relation.
 *
 * Unlike creating an event by hand, an import does not write to the shared
 * Google Calendar. These are events that already exist on Monday, and usually
 * on the calendar too, so mirroring them would duplicate every one; editing an
 * imported event later is the path that backfills its calendar entry.
 */

/** Refuse anything implausible for a board export before parsing it. */
const MAX_CSV_BYTES = 10 * 1024 * 1024

/**
 * What the import would do, or did, for one row.
 *
 * - `CREATE` — a new event.
 * - `ALREADY_IMPORTED` — an event with this title and start already exists.
 * - `NEEDS_LOCATION` — the row has no address and no default was given.
 */
type EventAction = 'CREATE' | 'ALREADY_IMPORTED' | 'NEEDS_LOCATION'

interface EventReport {
  rowNumber: number
  title: string
  startTime: string
  endTime: string
  location: string | null
  usedDefaultLocation: boolean
  eventType: EventType
  eventTypeRaw: string | null
  usedDefaultType: boolean
  action: EventAction
  warnings: string[]
  /** Set only on a commit that failed for this row; the rest still ran. */
  error?: string
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const body = await readBody<{
    csv?: unknown
    commit?: unknown
    defaultEventType?: unknown
    defaultLocation?: unknown
  }>(event)
  const csv = typeof body?.csv === 'string' ? body.csv : ''
  const commit = body?.commit === true
  const defaultEventType: EventType = isEventType(body?.defaultEventType)
    ? body.defaultEventType
    : 'VOLUNTEERS_AND_ATTENDEES'
  const defaultLocation = typeof body?.defaultLocation === 'string' ? body.defaultLocation.trim() : ''

  if (!csv.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'No CSV content was sent.' })
  }
  if (Buffer.byteLength(csv, 'utf8') > MAX_CSV_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'That file is larger than this importer accepts (10 MB).' })
  }

  const plan = planEventImport(parseCsvRows(csv))
  if (!plan) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No header row with a name and a date column was found — this does not look like an events board export.',
    })
  }
  if (plan.totalRows === 0) {
    throw createError({ statusCode: 400, statusMessage: 'The file has a header row but no events.' })
  }

  // One round-trip each rather than a lookup per row; this endpoint is also the
  // preview, and a board can hold years of events.
  const existingEvents = await prisma.event.findMany({
    where: { startTime: { in: plan.events.map(e => e.startTime) } },
    select: { title: true, startTime: true },
  })
  const storedKeys = new Set(existingEvents.map(e => eventImportKey(e.title, e.startTime)))

  const resolved = plan.events.map(planned => ({
    planned,
    location: planned.location ?? (defaultLocation || null),
    eventType: planned.eventType ?? defaultEventType,
  }))

  const addresses = [...new Set(resolved.map(r => r.location).filter((a): a is string => a !== null))]
  const knownLocations = await prisma.location.findMany({
    where: { address: { in: addresses } },
    select: { address: true, latitude: true, longitude: true },
  })
  // Address → coordinates, or null once geocoding it has failed, so a bad
  // address shared by twenty rows costs one request rather than twenty.
  const locationCache = new Map<string, GeocodedLocation | null>(knownLocations.map(l => [l.address, l]))

  const reports: EventReport[] = []
  let geocodeCalls = 0

  for (const { planned, location, eventType } of resolved) {
    const action: EventAction
      = storedKeys.has(eventImportKey(planned.title, planned.startTime))
        ? 'ALREADY_IMPORTED'
        : !location
            ? 'NEEDS_LOCATION'
            : 'CREATE'

    const report: EventReport = {
      rowNumber: planned.rowNumber,
      title: planned.title,
      startTime: planned.startTime.toISOString(),
      endTime: planned.endTime.toISOString(),
      location,
      usedDefaultLocation: !planned.location && !!location,
      eventType,
      eventTypeRaw: planned.eventTypeRaw,
      usedDefaultType: !planned.eventType,
      action,
      warnings: planned.warnings,
    }

    if (commit && action === 'CREATE') {
      try {
        if (!locationCache.has(location!)) {
          // Nominatim allows about one request a second. Spacing them here is
          // what keeps a file of new addresses from getting the server's IP
          // blocked, at the cost of the commit taking a second per address.
          if (geocodeCalls > 0) await sleep(GEOCODE_INTERVAL_MS)
          geocodeCalls += 1
          locationCache.set(location!, await geocodeLocation(location!))
        }

        const locationData = locationCache.get(location!)
        if (!locationData) {
          throw new Error(`Could not find "${location}" on the map. Fix the address on the board, or create this event by hand.`)
        }

        await createEvent(planned, eventType, locationData)
      }
      catch (error) {
        report.error = error instanceof Error ? error.message : String(error)
        console.error('[ingest] failed for event row', planned.rowNumber, error)
      }
    }

    reports.push(report)
  }

  const counted = (action: EventAction) => reports.filter(r => r.action === action).length
  const toCreate = reports.filter(r => r.action === 'CREATE')

  return {
    mode: commit ? 'commit' : 'preview',
    totalRows: plan.totalRows,
    missingColumns: plan.missingColumns,
    rejected: plan.rejected,
    summary: {
      events: reports.length,
      create: toCreate.length,
      alreadyImported: counted('ALREADY_IMPORTED'),
      needsLocation: counted('NEEDS_LOCATION'),
      withWarnings: reports.filter(r => r.warnings.length > 0).length,
      // Addresses that will need a geocoding request — roughly how many
      // seconds the commit will take.
      newLocations: new Set(
        toCreate.map(r => r.location!).filter(a => !knownLocations.some(l => l.address === a)),
      ).size,
      failed: reports.filter(r => r.error).length,
    },
    events: reports,
  }
})

/**
 * Writes one event. Its own statement rather than one transaction around the
 * file, for the reason `volunteers.post.ts` gives: a row that fails is reported
 * on its own, the rest of the file still lands, and the title-and-start key
 * makes running it again safe.
 */
async function createEvent(planned: PlannedEvent, eventType: EventType, location: GeocodedLocation) {
  await prisma.event.create({
    data: {
      title: planned.title,
      shortDesc: planned.shortDesc,
      description: planned.description,
      startTime: planned.startTime,
      endTime: planned.endTime,
      ...eventTypeToFlags(eventType),
      location: {
        connectOrCreate: {
          where: { address: location.address },
          create: location,
        },
      },
    },
  })
}
