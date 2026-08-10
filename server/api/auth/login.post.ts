import { auth } from '#server/utils/auth'
import type { H3Event } from 'h3'
import { appendHeader, setHeader } from 'h3'

/**
 * DEAD CODE — email + password sign-in. Nothing calls this, and it cannot
 * succeed as written.
 *
 * `auth.api.signInEmail` requires the `emailAndPassword` provider, which is not
 * enabled in `server/utils/auth.ts`; the app authenticates with Google OAuth
 * and email OTP only, and there is no password column on `User`. Calling this
 * route throws from better-auth rather than logging anyone in.
 *
 * Kept only because removing it is a separate change. Do not build on it —
 * enabling password auth means configuring the provider first. See
 * `request-otp.post.ts` / `sign-up-verify.post.ts` for the live flow.
 */

const forwardAuthHeaders = (event: H3Event, headers?: Headers) => {
  if (!headers) {
    return
  }
  headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      appendHeader(event, 'set-cookie', value)
    }
    else {
      setHeader(event, key, value)
    }
  })
}

export default defineEventHandler(async (event) => {
  try {
    const { email, password } = await readBody(event)

    const { response, headers } = await auth.api.signInEmail({
      body: { email, password },
      headers: event.headers,
      returnHeaders: true,
    })
    forwardAuthHeaders(event, headers)

    return { success: true, ...response }
  }
  catch (error: unknown) {
    console.log(error)
    throw createError({
      statusCode: (error as { statusCode: number }).statusCode,
      statusMessage: (error as { body: { message: string } }).body?.message || 'An unexpected error occurred',
    })
  }
})
