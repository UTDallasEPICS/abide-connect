import { computed, ref } from 'vue'
import { apiFetch, clearSessionCookies } from '~/lib/api'

/**
 * The authenticated session, shared app-wide.
 *
 * Native stand-in for the bits of `useUserSession`/`useFetch` the web app
 * leaned on. State lives at module scope so the shell, the nav bar and every
 * page read the same signed-in user without a per-caller request — the same
 * "one shared answer" intent as the web `user-roles` fetch key.
 *
 * Because there is no SSR, there is also no `useRequestHeaders(['cookie'])`
 * dance: the platform `fetch` carries the session cookie itself (see
 * `app/lib/api.ts`).
 */

export interface NativeSessionUser {
  id?: string
  name?: string
  email?: string
  image?: string | null
  [key: string]: unknown
}

export interface NativeSessionData {
  session?: { id?: string, expiresAt?: string, [key: string]: unknown }
  user?: NativeSessionUser
}

const session = ref<NativeSessionData | null>(null)
const loading = ref(false)
let loaded = false

export function useSession() {
  /**
   * Fetch the session once, then serve the cached value. Pass `force` after
   * anything that could change it (sign-in, sign-out).
   */
  async function refresh(force = false): Promise<NativeSessionData | null> {
    if (loading.value) return session.value
    if (loaded && !force) return session.value

    loading.value = true
    try {
      session.value = await apiFetch<NativeSessionData>('/api/auth/get-session')
    }
    catch {
      // A 401 (or any failure) is treated as "signed out" here; the guard in
      // `useNativeNavigate` only needs a yes/no, and the real error is
      // reported by whichever page made the call.
      session.value = null
    }
    finally {
      loading.value = false
      loaded = true
    }
    return session.value
  }

  /** Clear local session state and cookies (does not hit the server). */
  function clear(): void {
    session.value = null
    loaded = false
    clearSessionCookies()
  }

  const isSignedIn = computed(() => Boolean(session.value?.session))
  const user = computed(() => session.value?.user ?? null)

  return { session, user, isSignedIn, loading, refresh, clear }
}
