/** Pulls the human-readable message out of an $fetch error. */
export function errorMessage(error: unknown): string {
  return (error as { statusMessage?: string }).statusMessage
    ?? (error as { data?: { statusMessage?: string } }).data?.statusMessage
    ?? (error as { message?: string }).message
    ?? 'Please try again.'
}
