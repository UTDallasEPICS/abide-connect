import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'
import type { Language, Availability } from '#server/utils/generated/prisma/client'
import { Prisma } from '#server/utils/generated/prisma/client'
import type { H3Event } from 'h3'
import { appendHeader, setHeader } from 'h3'

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


    await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: name as string | undefined,
          email: email as string,
          phone: phone as string | undefined,
        },
      })

    })

    // OTP still in Verification table — signInEmailOTP validates it and creates
    // a session now that the Volunteer record exists, then consumes the OTP.
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
