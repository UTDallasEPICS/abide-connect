import { apiFetch } from './api'

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
}

export async function fetchApi<T = unknown>(
  path: string,
  options: Parameters<typeof apiFetch>[1] = {}
): Promise<T> {
  try {
    return await apiFetch<T>(path, options)
  } catch (error) {
    throw error
  }
}

export const get = <T = unknown>(path: string, options?: Parameters<typeof apiFetch>[1]) =>
  fetchApi<T>(path, { ...options, method: 'GET' })

export const post = <T = unknown>(path: string, body?: unknown, options?: Parameters<typeof apiFetch>[1]) =>
  fetchApi<T>(path, { ...options, method: 'POST', body })

export const put = <T = unknown>(path: string, body?: unknown, options?: Parameters<typeof apiFetch>[1]) =>
  fetchApi<T>(path, { ...options, method: 'PUT', body })

export const del = <T = unknown>(path: string, options?: Parameters<typeof apiFetch>[1]) =>
  fetchApi<T>(path, { ...options, method: 'DELETE' })
