import { useFetch } from '#app'

export const relativeFetch = ((url: string, opts?: any) => {
  try {
    if (url.startsWith('http')) url = new URL(url).pathname
  } catch {}
  return useFetch(url, opts)
}) as any