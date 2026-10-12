import { computed, ref } from 'vue'
import { apiFetch } from '~/lib/api'

/**
 * Current user's active roles, lowercased (e.g. `['user', 'volunteer']`).
 *
 * Native rewrite of the web composable, which used `useFetch` with a shared
 * `user-roles` key. There is no Nuxt data layer here, so the same "one answer
 * for every caller" behaviour comes from module-scope state instead. Returns
 * an empty array when nobody is signed in.
 */

const roles = ref<string[]>([])
const loading = ref(false)
let loaded = false

export function useUserRoles() {
  /**
   * Fetch roles once, then serve the cached value. Pass `force` after
   * sign-in/out or any role change.
   */
  async function refresh(force = false): Promise<string[]> {
    if (loading.value) return roles.value
    if (loaded && !force) return roles.value

    loading.value = true
    try {
      roles.value = await apiFetch<string[]>('/api/user/roles')
    }
    catch {
      // Signed out (or unreachable): no roles, same as the web default.
      roles.value = []
    }
    finally {
      loading.value = false
      loaded = true
    }
    return roles.value
  }

  /** Clear cached roles (used on sign-out). */
  function clear(): void {
    roles.value = []
    loaded = false
  }

  const isAdmin = computed(() => roles.value.includes('admin'))
  const isVolunteer = computed(() => roles.value.includes('volunteer'))
  const isUser = computed(() => roles.value.includes('user'))

  return { roles, isAdmin, isVolunteer, isUser, loading, refresh, clear }
}
