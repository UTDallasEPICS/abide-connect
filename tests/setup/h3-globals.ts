import { vi } from 'vitest'

/**
 * Minimal stand-ins for the h3 helpers Nitro auto-imports.
 *
 * Server route files call `defineEventHandler`, `getQuery`, `createError`,
 * `readBody` and `setHeader` without importing them — Nitro injects those at
 * build time. Importing a route directly from a test therefore needs them on
 * `globalThis`, and these implementations match h3's contract closely enough
 * for handlers that only read the query, the body and the response headers.
 *
 * `createError` produces a real `Error` carrying `statusCode`/`statusMessage`,
 * so `expect(...).rejects.toMatchObject({ statusCode: 400 })` works the same way
 * it would against the running server.
 */

export interface FakeH3Event {
  context: Record<string, unknown>
  headers: Headers
  __query: Record<string, string>
  __body: unknown
  __responseHeaders: Record<string, string>
}

export function createFakeEvent(options: {
  query?: Record<string, string | number | undefined>
  params?: Record<string, string>
  body?: unknown
} = {}): FakeH3Event {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) query[key] = String(value)
  }

  return {
    context: { params: options.params ?? {} },
    headers: new Headers(),
    __query: query,
    __body: options.body,
    __responseHeaders: {},
  }
}

const globals = {
  defineEventHandler: <T>(handler: T) => handler,
  eventHandler: <T>(handler: T) => handler,
  getQuery: (event: FakeH3Event) => event.__query,
  readBody: async (event: FakeH3Event) => event.__body,
  setHeader: (event: FakeH3Event, name: string, value: string) => {
    event.__responseHeaders[name.toLowerCase()] = value
  },
  getRouterParam: (event: FakeH3Event, name: string) =>
    (event.context.params as Record<string, string>)?.[name],
  createError: (input: { statusCode?: number, statusMessage?: string, message?: string }) => {
    const error = new Error(input.statusMessage ?? input.message ?? 'Error') as Error & {
      statusCode?: number
      statusMessage?: string
    }
    error.statusCode = input.statusCode
    error.statusMessage = input.statusMessage
    return error
  },
}

for (const [name, implementation] of Object.entries(globals)) {
  vi.stubGlobal(name, implementation)
}
