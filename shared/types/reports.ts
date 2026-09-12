/**
 * The shapes `/api/admin/reports/*` returns.
 *
 * In `shared/` so the pages and the handlers are held to the same contract —
 * these payloads are wide, and a page that quietly reads a field the handler
 * stopped sending renders a blank chart rather than failing.
 *
 * Every `hours` figure is already rounded for display, and every date crossing
 * the wire is an ISO string.
 */

import type { Granularity, RangePresetId } from '#shared/utils/reportRange'

/** Which hour logs a report counted. */
export type HourStatusFilter = 'approved' | 'all'

/**
 * What the filter row above the charts holds, and what goes on the query
 * string. One object drives every panel on a page — per-chart filters are how
 * a dashboard ends up with two cards quietly describing different periods.
 */
export interface ReportFilterState {
  preset: RangePresetId
  /** `YYYY-MM-DD`, only read when `preset` is CUSTOM. */
  from: string
  to: string
  status: HourStatusFilter
  granularity: Granularity | 'auto'
}

/** Echoed back so the page can title itself with what the server actually used. */
export interface ResolvedRange {
  preset: RangePresetId
  /** `YYYY-MM-DD`, inclusive. */
  from: string
  /** `YYYY-MM-DD`, inclusive — the last day covered, not the exclusive bound. */
  to: string
  label: string
  days: number
  granularity: Granularity
  timeZone: string
  status: HourStatusFilter
}

export interface HoursSummary {
  totalHours: number
  approvedHours: number
  pendingHours: number
  rejectedHours: number
  /** Volunteers with at least one counted log in the range. */
  activeVolunteers: number
  /** Volunteers on the roster, whether or not they logged anything. */
  rosterVolunteers: number
  meanHoursPerVolunteer: number
  /** Always shown beside the mean — a long tail inflates the mean badly. */
  medianHoursPerVolunteer: number
  totalEntries: number
  /** Share of counted hours contributed by the busiest 10% of volunteers. */
  topDecileShare: number
  /** Same total, one year earlier, for the headline delta. */
  priorPeriodHours: number
}

export interface TimeSeriesPoint {
  key: string
  label: string
  /** ISO start of the bucket, for the tooltip's full date. */
  start: string
  hours: number
  /** Distinct volunteers who logged in this bucket. */
  volunteers: number
  /** hours ÷ volunteers — the engagement signal the two lines are read for. */
  hoursPerVolunteer: number
}

export interface HistogramBin {
  label: string
  /** Inclusive lower bound of the bin, in hours. */
  from: number
  /** Exclusive upper bound; null on the open-ended top bin. */
  to: number | null
  volunteers: number
}

export interface DistributionReport {
  bins: HistogramBin[]
  mean: number
  median: number
  max: number
  /** Volunteers accounting for the first half of all hours, busiest first. */
  volunteersForHalfOfHours: number
  totalVolunteers: number
}

export interface LapseRiskEntry {
  volunteerId: string
  name: string
  email: string | null
  daysSinceLastHour: number
  lastHourDate: string
  lifetimeHours: number
  /** Hours logged in the last 12 months — how much activity is going quiet. */
  recentHours: number
  /** What they were last doing, for the opening line of the outreach call. */
  lastActivity: string
}

export interface CoverageCell {
  /** 0 = Sunday, matching `Date.prototype.getDay`. */
  weekday: number
  band: string
  filledHours: number
  /** Hours the published shifts asked for; 0 where no event used time blocks. */
  neededHours: number
  /** filledHours ÷ neededHours, or null where nothing was asked for. */
  fillRate: number | null
}

export interface CoverageReport {
  cells: CoverageCell[]
  bands: { id: string, label: string, fromHour: number, toHour: number }[]
  maxFilledHours: number
  /** True when no event in the range used time blocks, so "needed" is unknown. */
  needsAreUnknown: boolean
  /** The worst-covered slot with a real ask behind it, for the callout. */
  worstGap: { weekday: number, band: string, fillRate: number, shortfallHours: number } | null
}

export interface ApprovalBacklog {
  pendingCount: number
  pendingHours: number
  oldestPendingDays: number | null
  oldestPendingDate: string | null
  /** Days from submission to decision, over logs decided in the range. */
  medianDaysToDecision: number | null
  decidedCount: number
  /** Decided logs with no `approvedAt` stamp, excluded from the median. */
  unmeasuredCount: number
}

export interface NewVsReturningPoint {
  key: string
  label: string
  newHours: number
  returningHours: number
  newVolunteers: number
  returningVolunteers: number
}

export interface CohortRow {
  /** `YYYY-MM`. */
  cohort: string
  label: string
  size: number
  /** Retention percentage by months-since-signup; null past the present. */
  values: (number | null)[]
}

export interface RetentionReport {
  rows: CohortRow[]
  /** Column headers: "M0", "M1", … */
  columns: string[]
}

/** The operational admin report — `/api/admin/reports/hours`. */
export interface HoursReport {
  range: ResolvedRange
  summary: HoursSummary
  series: TimeSeriesPoint[]
  distribution: DistributionReport
  lapseRisk: LapseRiskEntry[]
  lapseThresholdDays: number
  coverage: CoverageReport
  backlog: ApprovalBacklog
  newVsReturning: NewVsReturningPoint[]
  retention: RetentionReport
}

export interface ProgramHours {
  program: string
  label: string
  hours: number
  value: number
  volunteers: number
  /** Hours attributed by falling back to the volunteer's single area, not by
   *  an explicit tag on the log — surfaced so the number isn't over-trusted. */
  inferredHours: number
}

export interface YearOverYearPoint {
  key: string
  label: string
  hours: number
  priorHours: number
}

/** The leadership / funder report — `/api/admin/reports/impact`. */
export interface ImpactReport {
  range: ResolvedRange
  priorRange: { from: string, to: string, label: string }
  totals: {
    hours: number
    priorHours: number
    /** Percentage change vs the prior year; null when the prior year is empty. */
    hoursChangePct: number | null
    inKindValue: number
    priorInKindValue: number
    volunteers: number
    priorVolunteers: number
    entries: number
    averageHoursPerVolunteer: number
    /** Whole-time-equivalent staff the hours stand in for, at 2,080 hrs/yr. */
    fullTimeEquivalent: number
  }
  monthly: YearOverYearPoint[]
  programs: ProgramHours[]
  rate: {
    hourlyRate: number
    source: string
    usingDefaults: boolean
    updatedAt: string | null
  }
}
