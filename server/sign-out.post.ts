export default defineEventHandler(async (event) => {
  try {
    const response = await auth.api.signOut({
      headers: event.headers,
    })

    return response
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to sign out",
    })
  }
})