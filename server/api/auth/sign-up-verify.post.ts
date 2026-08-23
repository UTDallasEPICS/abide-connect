import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'
import { Prisma } from '#server/utils/generated/prisma/client'
import type { H3Event } from 'h3'
import { appendHeader, setHeader } from 'h3'

/**
 * Copies better-auth's response headers onto our own response.
 *
 * Necessary because `signInEmailOTP` is called server-to-server here rather
 * than being reached by the browser directly, so the session cookie it mints
 * would otherwise be discarded and the user would finish sign-up logged out.
 * `set-cookie` is appended rather than set — there can legitimately be several
 * (session token, CSRF) and `setHeader` would keep only the last.
 */
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

// Matches the emailOTP plugin's own default (`allowedAttempts || 3`), so a code
// is retired after the same number of wrong guesses whichever path checks it.
const ALLOWED_OTP_ATTEMPTS = 3

/**
 * Completes sign-up: checks the emailed code, creates the account, and returns
 * with a live session — the second half of the flow started by
 * `request-otp.post.ts`.
 *
 * The order matters and is a little counter-intuitive. The OTP is *verified*
 * here but deliberately not consumed; the `Verification` row is left in place
 * so that `signInEmailOTP` below can validate it a second time and retire it
 * itself. Deleting it after the first check would leave the new account created
 * but unable to sign in.
 *
 * Creating the user before signing in is also required, not incidental: the
 * emailOTP plugin runs with `disableSignUp: true`, so `signInEmailOTP` only
 * succeeds against an account that already exists.
 *
 * That ordering is why the code check below has to be exact and rate-limited on
 * its own terms: it gates a `user.create` that commits before Better Auth ever
 * sees the code, so anything it lets through becomes a real account.
 */
export default defineEventHandler(async (event) => {
  try {
    const {
      otp,
      name,
      email,
      phone,
    } = await readBody(event)

    // Reject anything that isn't a well-formed code before it reaches the
    // database — `otp` arrives straight off the request body, so it is not
    // necessarily a string, let alone six digits.
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid or expired code' })
    }

    // Validate the OTP exists and hasn't expired before creating the account.
    // Better Auth stores these under identifier "sign-in-otp-<email>" with the
    // value "<otp>:<attempts>". Several stale rows can exist for one email, so
    // take the newest and compare the code segment in code rather than filtering
    // on it — a `startsWith` filter on the raw `otp` matches on any prefix, and
    // an empty string would match every outstanding row.
    const verification = await prisma.verification.findFirst({
      where: { identifier: `sign-in-otp-${email}` },
      orderBy: { expiresAt: 'desc' },
    })

    if (!verification || new Date() > verification.expiresAt) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid or expired code' })
    }

    // Mirror Better Auth's own attempt accounting (`splitAtLastColon`, capped at
    // `allowedAttempts`). This check has to do it itself: a wrong code throws
    // here, before `signInEmailOTP` is ever reached, so the library never sees
    // the failure and never increments the counter. Without this the endpoint is
    // an unmetered oracle — the resend cooldown in `request-otp.post.ts` limits
    // issuing codes, not guessing them.
    const separator = verification.value.lastIndexOf(':')
    const storedOtp = separator === -1 ? verification.value : verification.value.slice(0, separator)
    const attempts = separator === -1
      ? 0
      : Number.parseInt(verification.value.slice(separator + 1), 10) || 0

    if (attempts >= ALLOWED_OTP_ATTEMPTS) {
      throw createError({ statusCode: 429, statusMessage: 'Too many attempts. Request a new code.' })
    }

    if (storedOtp !== otp) {
      await prisma.verification.update({
        where: { id: verification.id },
        data: { value: `${storedOtp}:${attempts + 1}` },
      })
      throw createError({ statusCode: 400, statusMessage: 'Invalid or expired code' })
    }

    // The transaction wraps a single statement and so buys nothing today; it's
    // a seam left for the related rows (volunteer profile, notification
    // preferences) that sign-up is expected to grow.
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          name: name as string | undefined,
          email: email as string,
          phone: phone as string | undefined,
          roles: {
            create: {
              role: 'USER',
              active: true,
            },
          },
        },
      })
    })

    // The OTP row is still present — signInEmailOTP validates it a second time,
    // mints the session, and only then consumes it. (No Volunteer record is
    // created during sign-up; volunteers apply separately via
    // /volunteer-application.)
    const { response, headers } = await auth.api.signInEmailOTP({
      body: { email, otp },
      headers: event.headers,
      returnHeaders: true,
    })

    forwardAuthHeaders(event, headers)

    return { success: true, ...response }
  }
  catch (error: unknown) {
    console.error('[sign-up-verify error]', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' })
    }

    const statusCode = (error as { statusCode?: number }).statusCode ?? 500
    const statusMessage
      = (error as { body?: { message?: string } }).body?.message
        ?? (error as { statusMessage?: string }).statusMessage
        ?? (error as { message?: string }).message
        ?? 'An unexpected error occurred'

    throw createError({ statusCode, statusMessage })
  }
})
