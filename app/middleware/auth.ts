export default defineNuxtRouteMiddleware(async (to) => {
  const publicRoutes = ['/auth/login', '/auth/sign-up']
  if (publicRoutes.includes(to.path)) return

  try {
    const data = await $fetch('/api/auth/get-session', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })

    if (!data?.session) {
      return navigateTo('/auth/login')
    }

    const requiredRole = to.meta.requiredRole as string | undefined

    if (requiredRole) {
      const userRoles: string[] = data.user?.roles?.map((r: { role: string }) => r.role) ?? []
      if (!userRoles.includes(requiredRole)) {
        return navigateTo("/unauthorized");
      }
    }
  }
  catch(e) {
    console.log('Error in auth middleware:', e);
    return navigateTo('/auth/login');
  }
})