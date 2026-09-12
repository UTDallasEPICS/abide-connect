import prisma from '#server/utils/prisma'
import { Prisma } from '#server/utils/generated/prisma/client'

/**
 * DEAD CODE — superseded by `sign-up-verify.post.ts`. Nothing calls this.
 *
 * It predates the OTP-verified sign-up flow and creates an account with no
 * email verification at all. It also omits the `USER` role that
 * `sign-up-verify` grants, so any account it did create would fail the role
 * checks in `app/middleware/auth.global.ts` and be unable to reach the app.
 *
 * Kept only because removing it is a separate change; the live path is
 * `request-otp` → `sign-up-verify`.
 */
export default defineEventHandler(async (event) => {
  try {
    const {
      name,
      email,
      phone,
    } = await readBody(event)

    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          name: name as string | undefined,
          email: email as string,
          phone: phone as string | undefined,
        },
      })
    })

    return { success: true }
  }
  catch (error: unknown) {
    console.error('[sign-up error]', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' })
    }

    const statusCode = (error as { statusCode?: number }).statusCode ?? 500
    const statusMessage
      = (error as { body?: { message?: string } }).body?.message
        ?? (error as { message?: string }).message
        ?? 'An unexpected error occurred'

    throw createError({ statusCode, statusMessage })
  }
})
