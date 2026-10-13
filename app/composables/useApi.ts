import { apiFetch } from '~/lib/api'

export function useApi() {
  const get = async <T = unknown>(path: string, query?: Record<string, any>) => {
    return await apiFetch<T>(path, { query })
  }

  const post = async <T = unknown>(path: string, body?: unknown, query?: Record<string, any>) => {
    return await apiFetch<T>(path, { method: 'POST', body, query })
  }

  const put = async <T = unknown>(path: string, body?: unknown, query?: Record<string, any>) => {
    return await apiFetch<T>(path, { method: 'PUT', body, query })
  }

  const del = async <T = unknown>(path: string, query?: Record<string, any>) => {
    return await apiFetch<T>(path, { method: 'DELETE', query })
  }

  return { get, post, put, del, fetch: apiFetch }
}
