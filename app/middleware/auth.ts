export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    const { auth } = await import('#server/utils/auth')
    const event = useRequestEvent()!

    const session = await auth.api.getSession({
      headers: event.node.req.headers as any
    })

    if (!session) {
      return navigateTo('/auth/login', { redirectCode: 302 })
    }

  } else {
    const data = await $fetch('/api/auth/get-session')
    if (!data?.session) return navigateTo('/auth/login')
  }
})