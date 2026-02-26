export default defineNuxtRouteMiddleware(async (to) => {
  const publicRoutes = ['/auth/login', '/auth/sign-up']
  if (publicRoutes.includes(to.path)) return

  try {
    const data = await $fetch('/api/auth/get-session')
    
    if (!data?.session) {
      return navigateTo('/auth/login')
    }
  } catch {
    return navigateTo('/auth/login')
  }
})