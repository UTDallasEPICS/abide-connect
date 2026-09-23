import { auth } from '#server/utils/auth'
import { normalizeEmail } from '#server/utils/normalizeEmail'
import { activeRoles } from '#server/utils/userRoles'
import type { H3Event } from 'h3'
import { appendHeader, setHeader } from 'h3'

/**
 * Signs an existing user in with an emailed OTP — the second half of the login
 * flow that `request-otp.post.ts` starts.
 *
 * Distinct from `sign-up-verify.post.ts`: that one creates the account first,
 * this one assumes it already exists (the emailOTP plugin runs with
 * `disableSignUp: true`, so an unknown address fails here rather than
 * registering).
 *
 * `roles` rides along in the response so the login page can pick a landing page
 * without a second request. It could ask `/api/user/roles` instead, but that
 * request would race the session cookie this response is still in the middle of
 * setting — and a roles call that comes back empty is indistinguishable from a
 * user who has none, which silently lands everyone on the home page. The
 * session is already in hand here, so there is nothing to race.
 */

// Copies response headers from better-auth onto the H3 event.
// This is how session cookies get sent back to the browser.
const forwardAuthHeaders = (event: H3Event, headers?: Headers) => {
  if (!headers) return
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
    // Read both the email and the OTP code the user typed in. The address is
    // normalised the same way `request-otp` normalised it when it wrote the
    // verification row, so the two agree on the identifier whatever the user
    // typed.
    const { email: rawEmail, otp } = await readBody(event)
    const email = normalizeEmail(rawEmail)
    const { response, headers } = await auth.api.signInEmailOTP({
      body: { email, otp },
      headers: event.headers,
      returnHeaders: true,
    })

    forwardAuthHeaders(event, headers)

    const roles = response?.user?.id ? await activeRoles(response.user.id) : []

    return { success: true, ...response, roles }
  }
  catch (error: unknown) {
    console.log(error)
    throw createError({
      statusCode: (error as { statusCode: number }).statusCode ?? 500,
      statusMessage:
                (error as { body: { message: string } }).body?.message
                ?? 'Invalid or expired code',
    })
  }
})
