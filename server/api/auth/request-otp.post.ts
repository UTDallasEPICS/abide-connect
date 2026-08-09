import { transporter } from '#server/utils/auth'
import { buildOtpEmail } from '#server/utils/otp-email'
import prisma from '#server/utils/prisma'
import { randomInt, randomBytes } from 'crypto'

// Minimum seconds between OTP requests for the same email. Mirrors the resend
// cooldown the login/sign-up pages show, so the client and server agree.
const RESEND_COOLDOWN_SECONDS = 30

export default defineEventHandler(async (event) => {
  try {
    const { email } = await readBody(event)
    const identifier = `sign-in-otp-${email}`

    const lastRequest = await prisma.verification.findFirst({
      where: { identifier },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })

    if (lastRequest) {
      const elapsed = (Date.now() - lastRequest.createdAt.getTime()) / 1000
      if (elapsed < RESEND_COOLDOWN_SECONDS) {
        const retryAfter = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed)
        setHeader(event, 'retry-after', retryAfter.toString())
        throw createError({
          statusCode: 429,
          statusMessage: `Please wait ${retryAfter}s before requesting another code.`,
        })
      }
    }

    // Only one code should ever be valid at a time — drop any outstanding ones
    // so a stale code can't be used after a new one is issued.
    await prisma.verification.deleteMany({ where: { identifier } })

    const otp = randomInt(100000, 1000000).toString()
    const id = randomBytes(16).toString('hex')
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await prisma.verification.create({
      data: {
        id,
        identifier,
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
        (error as { statusMessage?: string }).statusMessage
        ?? (error as { message?: string }).message
        ?? 'An unexpected error occurred',
    })
  }
})
