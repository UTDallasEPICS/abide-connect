import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'

const routeRoles: Record<string, string> = {
  '/admin':     'admin',
  '/volunteer': 'volunteer',
}

function deny(event: any, isApi: boolean, loggedIn: boolean) {
  if (isApi) {
    throw createError({ statusCode: loggedIn ? 403 : 401, message: loggedIn ? 'Forbidden' : 'Unauthorized' })
  }
  return sendRedirect(event, loggedIn ? '/unauthorized' : '/auth/login', 302)
}

export default defineEventHandler(async (event) => {
  const path = event.path;
  const isApi = path.startsWith('/api');

  const session = await auth.api.getSession({ headers: event.headers });
  event.context.session = session;

  for (const [route, requiredRole] of Object.entries(routeRoles)) {
    if (path.startsWith(route) /**  || path.startsWith(`/api${route}`) */) {
      if (!session?.session) {
        return deny(event, isApi, false)
      }

      const userRoles = await prisma.user_Role.findMany({
        where: { userId: session.user.id, active: true, },
      });

      const roles = userRoles.map(r => r.role.toLowerCase());

      console.log(`[auth] path: ${path} | required: ${requiredRole} | user roles: [${roles.join(', ')}]`)

      if (!roles.includes(requiredRole)) { 
        return deny(event, isApi, true)
      }
    }
  }
})