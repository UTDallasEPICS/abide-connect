import type { Ref } from 'vue'

export interface UserUpcomingEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  address: string | null
  isTraining: boolean
  isVolunteer: boolean
  imageUrl: string | null
}

interface CachedUserUpcomingEvents {
  events: UserUpcomingEvent[]
  fetchedAt: number
}

type UserUpcomingEventsCache = Record<string, CachedUserUpcomingEvents>

const CACHE_KEY = 'private-user-upcoming-events'
const STORAGE_KEY_PREFIX = `${CACHE_KEY}:`
const CACHE_TTL_MS = 5 * 60_000

function storageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}${userId}`
}

function readStoredEvents(userId: string): CachedUserUpcomingEvents | null {
  if (!import.meta.client) return null

  try {
    const stored = sessionStorage.getItem(storageKey(userId))
    if (!stored) return null

    const parsed = JSON.parse(stored) as Partial<CachedUserUpcomingEvents>
    if (!Array.isArray(parsed.events) || typeof parsed.fetchedAt !== 'number') {
      return null
    }

    return {
      events: parsed.events,
      fetchedAt: parsed.fetchedAt,
    }
  }
  catch {
    return null
  }
}

function writeStoredEvents(userId: string, cached: CachedUserUpcomingEvents) {
  if (!import.meta.client) return

  try {
    sessionStorage.setItem(storageKey(userId), JSON.stringify(cached))
  }
  catch {
    // The in-memory cache still works if browser storage is unavailable/full.
  }
}

function removeStoredEvents(userId?: string) {
  if (!import.meta.client) return

  try {
    if (userId) {
      sessionStorage.removeItem(storageKey(userId))
      return
    }

    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index)
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        sessionStorage.removeItem(key)
      }
    }
  }
  catch {
    // Cache invalidation is best effort; the in-memory cache is cleared below.
  }
}

/**
 * Client-only, per-user cache for the signed-in user's events.
 *
 * This deliberately does not use Nitro SWR: `/api/user/upcoming-events` is
 * session-scoped, while Nitro's route cache is URL-scoped and could otherwise
 * replay one user's response to another. The cache lives in Nuxt state and
 * sessionStorage, partitioned by user id, so it survives SPA navigation and
 * hard refreshes within the current tab without exposing one user's events to
 * another.
 */
export function useUserUpcomingEvents(
  user: Ref<{ id?: string } | null | undefined>,
) {
  const cache = useState<UserUpcomingEventsCache>(CACHE_KEY, () => ({}))
  const data = ref<UserUpcomingEvent[]>([])
  const pending = ref(false)
  const error = ref<unknown>(null)
  let requestVersion = 0

  async function refresh(force = false) {
    if (!import.meta.client) return

    const userId = user.value?.id
    if (!userId) {
      data.value = []
      pending.value = false
      error.value = null
      return
    }

    const cached = cache.value[userId] ?? readStoredEvents(userId)
    if (cached && !cache.value[userId]) {
      cache.value = {
        ...cache.value,
        [userId]: cached,
      }
    }

    if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      data.value = cached.events
      pending.value = false
      error.value = null
      return
    }

    const version = ++requestVersion
    pending.value = true
    error.value = null

    try {
      const events = await $fetch<UserUpcomingEvent[]>('/api/user/upcoming-events')
      if (version !== requestVersion || user.value?.id !== userId) return

      const nextCached = {
        events,
        fetchedAt: Date.now(),
      }
      cache.value = {
        ...cache.value,
        [userId]: nextCached,
      }
      writeStoredEvents(userId, nextCached)
      data.value = events
    }
    catch (fetchError) {
      if (version === requestVersion && user.value?.id === userId) {
        error.value = fetchError
      }
    }
    finally {
      if (version === requestVersion) pending.value = false
    }
  }

  watch(
    () => user.value?.id,
    (userId) => {
      requestVersion++
      error.value = null
      const cached = userId
        ? (cache.value[userId] ?? readStoredEvents(userId))
        : null
      if (userId && cached && !cache.value[userId]) {
        cache.value = {
          ...cache.value,
          [userId]: cached,
        }
      }
      data.value = cached?.events ?? []
      pending.value = !!userId && import.meta.client
      if (userId) void refresh()
    },
    { immediate: true },
  )

  return {
    data,
    pending,
    error,
    refresh,
  }
}

/**
 * Drop cached results after an RSVP mutation made outside the two listing
 * pages, such as registration or cancellation on an event detail page.
 */
export function clearUserUpcomingEventsCache(userId?: string) {
  const cache = useState<UserUpcomingEventsCache>(CACHE_KEY, () => ({}))
  removeStoredEvents(userId)
  if (!userId) {
    cache.value = {}
    return
  }

  const next = { ...cache.value }
  delete next[userId]
  cache.value = next
}
