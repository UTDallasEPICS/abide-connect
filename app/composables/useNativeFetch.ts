import { apiFetch } from '~/lib/api'

export function useNativeFetch<T = unknown>(path: string, options: Parameters<typeof apiFetch>[1] = {}) {
  const data = ref<T | null>(null)
  const pending = ref(false)
  const error = ref<unknown>(null)

  const refresh = async () => {
    pending.value = true
    error.value = null
    try {
      data.value = await apiFetch<T>(path, options)
    } catch (e) {
      error.value = e
    } finally {
      pending.value = false
    }
  }

  onMounted(refresh)

  return { data, pending, error, refresh }
}
