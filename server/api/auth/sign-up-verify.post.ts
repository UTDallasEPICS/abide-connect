import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'
import type { Language, Availability } from '#server/utils/generated/prisma/client'
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
 */
export default defineEventHandler(async (event) => {
  try {
    const {
      otp,
      name,
      email,
      phone,
    } = await readBody(event)

    // Validate OTP exists and hasn't expired before creating the account.
    // Better Auth stores with identifier "sign-in-otp-<email>" and value "<otp>:<attempts>".
    // Multiple stale records can exist for the same email, so match on the value prefix.
    const verification = await prisma.verification.findFirst({
      where: {
        identifier: `sign-in-otp-${email}`,
        value: { startsWith: otp },
      },
      orderBy: { expiresAt: 'desc' },
    })

    if (!verification || new Date() > verification.expiresAt) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid or expired code' })
    }


    // The transaction wraps a single statement and so buys nothing today; it's
    // a seam left for the related rows (volunteer profile, notification
    // preferences) that sign-up is expected to grow.
    await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
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
    const statusMessage =
      (error as { body?: { message?: string } }).body?.message
      ?? (error as { statusMessage?: string }).statusMessage
      ?? (error as { message?: string }).message
      ?? 'An unexpected error occurred'

    throw createError({ statusCode, statusMessage })
  }
})
