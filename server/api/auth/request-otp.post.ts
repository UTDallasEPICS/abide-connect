import { transporter } from '#server/utils/auth'
import { buildOtpEmail } from '#server/utils/otp-email'
import prisma from '#server/utils/prisma'
import { randomInt, randomBytes } from 'crypto'

/**
 * Issues a sign-in code by email, for the app's own sign-up flow.
 *
 * This exists instead of calling better-auth's `emailOTP.sendVerificationOTP`
 * directly because that path is gated by `disableSignUp: true` — it refuses to
 * issue codes for addresses with no account yet, which is exactly the case
 * during sign-up. So the `Verification` row is written by hand here, in the
 * format better-auth expects (`sign-in-otp-<email>` / `<otp>:<attempts>`), so
 * that `signInEmailOTP` can consume it later in `sign-up-verify.post.ts`.
 *
 * Because it bypasses the library's own guard, nothing throttles this route:
 * it will send mail to whatever address it's handed, as often as it's asked.
 * The resend cooldown on the login and sign-up pages is presentation only and
 * doesn't constrain a direct caller.
 *
 * The code is generated with `crypto.randomInt` rather than `Math.random`
 * because it's a security token — `Math.random` is predictable from prior
 * outputs.
 */
export default defineEventHandler(async (event) => {
  try {
    const { email } = await readBody(event)

    // Range is exclusive at the top, so this is 100000–999999: always six
    // digits, never one with a leading zero that could be mangled in transit.
    const otp = randomInt(100000, 1000000).toString()
    const id = randomBytes(16).toString('hex')
    // Must stay in step with `expiresIn` on the emailOTP plugin in auth.ts and
    // with the wording in the email body.
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await prisma.verification.create({
      data: {
        id,
        identifier: `sign-in-otp-${email}`,
        value: `${otp}:0`,
        expiresAt,
      },
    })

    const { subject, text, html } = buildOtpEmail(otp)
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject,
      text,
      html,
    })

    return { success: true }
  }
  catch (error: unknown) {
    console.error('[request-otp error]', error)
    throw createError({
      statusCode: (error as { statusCode?: number }).statusCode ?? 500,
      statusMessage:
        (error as { message?: string }).message ?? 'An unexpected error occurred',
    })
  }
})
