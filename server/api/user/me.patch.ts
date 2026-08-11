import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'
import { PushScope } from '#server/utils/generated/prisma/enums'

/**
 * Updates the signed-in user's own profile and notification preferences.
 *
 * Email is intentionally not editable here: it's the login identifier for both
 * auth methods (Google OAuth subject match and email OTP delivery), so changing
 * it would need a verification round-trip rather than a plain write. Any
 * `email` key in the body is ignored rather than rejected, so a client sending
 * back a whole user object doesn't fail.
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  }

  const body = await readBody(event)
  const data: {
    name?: string | null
    phone?: string | null
    pushEnabled?: boolean
    pushScope?: PushScope
    emailRemindersEnabled?: boolean
  } = {}

  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Name cannot be empty' })
    }
    if (name.length > 100) {
      throw createError({ statusCode: 400, statusMessage: 'Name must be 100 characters or fewer' })
    }
    data.name = name
  }

  if ('phone' in body) {
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    // Optional field — an empty string clears it rather than storing "".
    if (phone.length === 0) {
      data.phone = null
    }
    else if (!/^[+\d][\d\s\-().]{6,19}$/.test(phone)) {
      throw createError({ statusCode: 400, statusMessage: 'Please enter a valid phone number' })
    }
    else {
      data.phone = phone
    }
  }

  if ('pushEnabled' in body) {
    if (typeof body.pushEnabled !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'pushEnabled must be a boolean' })
    }
    data.pushEnabled = body.pushEnabled
  }

  if ('pushScope' in body) {
    if (!Object.values(PushScope).includes(body.pushScope)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid notification scope' })
    }
    data.pushScope = body.pushScope as PushScope
  }

  if ('emailRemindersEnabled' in body) {
    if (typeof body.emailRemindersEnabled !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'emailRemindersEnabled must be a boolean' })
    }
    data.emailRemindersEnabled = body.emailRemindersEnabled
  }

  if (Object.keys(data).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No updatable fields provided' })
  }

  return prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      imageURL: true,
      pushEnabled: true,
      pushScope: true,
      emailRemindersEnabled: true,
    },
  })
})
