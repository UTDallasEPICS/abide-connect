/**
 * Current user's active roles, lowercased (e.g. `['user', 'volunteer']`).
 *
 * Shares one request across every caller via the `user-roles` key, so the nav
 * and any page can ask about roles without refetching. Returns an empty array
 * when nobody is signed in.
 */
export function useUserRoles() {
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  const { data: roles } = useFetch<string[]>('/api/user/roles', {
    key: 'user-roles',
    headers,
    default: () => [],
  })

  const isAdmin = computed(() => roles.value.includes('admin'))
  const isVolunteer = computed(() => roles.value.includes('volunteer'))
  const isUser = computed(() => roles.value.includes('user'))

  return { roles, isAdmin, isVolunteer, isUser }
}
