import { transporter } from '#server/utils/auth'
import prisma from '#server/utils/prisma'
import { randomInt, randomBytes } from 'crypto'

export default defineEventHandler(async (event) => {
  try {
    const { email } = await readBody(event)

    const otp = randomInt(100000, 1000000).toString()
    const id = randomBytes(16).toString('hex')
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await prisma.verification.create({
      data: {
        id,
        identifier: `sign-in-otp-${email}`,
        value: `${otp}:0`,
        expiresAt,
      },
    })

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'OTP for Abide Connect',
      html: `Your OTP is: ${otp}`,
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
