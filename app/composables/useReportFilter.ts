import type { Granularity, RangePresetId } from '#shared/utils/reportRange'
import type { HourStatusFilter, ReportFilterState } from '#shared/types/reports'
import { dayKey, resolvePreset } from '#shared/utils/reportRange'

/**
 * The reporting filter, mirrored into the page's own URL.
 *
 * Round-tripping through the query string is what makes a report sendable: the
 * coordinator who has narrowed to a grant's exact period can paste the address
 * to a colleague and they see the same numbers. It also survives a refresh,
 * which matters on a page people leave open.
 *
 * `replace` rather than `push` on every change, so adjusting a date four times
 * doesn't bury the page under four back-button steps.
 */
export function useReportFilter(defaultPreset: RangePresetId = 'YTD') {
  const route = useRoute()
  const router = useRouter()

  const initialPreset = (typeof route.query.preset === 'string'
    ? route.query.preset.toUpperCase()
    : defaultPreset) as RangePresetId

  // A preset URL carries no dates, so resolve it once for the date boxes.
  const seeded = initialPreset === 'CUSTOM'
    ? null
    : resolvePreset(initialPreset as Exclude<RangePresetId, 'CUSTOM'>)

  const filter = ref<ReportFilterState>({
    preset: initialPreset,
    from: (route.query.from as string) ?? (seeded ? dayKey(seeded.start) : ''),
    to: (route.query.to as string)
      ?? (seeded ? dayKey(new Date(seeded.end.getTime() - 86_400_000)) : ''),
    status: (route.query.status === 'all' ? 'all' : 'approved') as HourStatusFilter,
    granularity: (['day', 'week', 'month'].includes(String(route.query.granularity))
      ? route.query.granularity
      : 'auto') as Granularity | 'auto',
  })

  /** What both the API calls and the CSV export link send. */
  const query = computed(() => ({
    preset: filter.value.preset,
    from: filter.value.from,
    to: filter.value.to,
    status: filter.value.status,
    granularity: filter.value.granularity,
  }))

  watch(query, (next) => {
    router.replace({ query: { ...route.query, ...next } })
  })

  /** `?a=b&c=d` for building an `<a href>` to a download endpoint. */
  const queryString = computed(() => new URLSearchParams(query.value).toString())

  return { filter, query, queryString }
}
