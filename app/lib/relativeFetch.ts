/* eslint-disable @typescript-eslint/no-explicit-any */
import { useFetch } from '#app'

export const relativeFetch = ((url: string, opts?: any) => {
  try {
    if (url.startsWith('http')) url = new URL(url).pathname
  } catch {
    // ignore invalid URLs
  }
  return useFetch(url, opts)
}) as any