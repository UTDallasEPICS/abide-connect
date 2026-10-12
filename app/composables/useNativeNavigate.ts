/* eslint-disable @typescript-eslint/no-explicit-any */
import { useNativeRouter } from 'nuxt-native/runtime/composables/useNativeRouter.js'
import { useSession } from './useSession'
import { useUserRoles } from './useUserRoles'

/**
 * Navigation for the native app, with the role guard folded in.
 *
 * Two Nuxt web features are gone natively and are replaced here:
 *
 * 1. `vue-router`. `useNativeRouter()` navigates by **route name** (derived
 *    from the page filename), not path. Pages and nav bars want to think in
 *    paths (`/volunteer`), so this exposes a path-first `to()` that resolves a
 *    path to its route and pushes it.
 *
 * 2. `app/middleware/auth.global.ts`. There is no route middleware in
 *    NativeScript, so the same prefix→role table runs inside `to()` *before*
 *    the page is pushed: no session → login; wrong role → unauthorized. It is
 *    the same UX affordance as the web guard, not a security boundary — server
 *    routes still enforce their own access via `requireRole`.
 */

/**
 * Route prefixes mapped to the role required to access them. Mirrors
 * `app/middleware/auth.global.ts` (which is now web-only). Longest prefix wins,
 * so an overlapping pair behaves the same on both platforms.
 */
const ROUTE_ROLES: Record<string, string> = {
  '/admin': 'admin',
  '/events/manage': 'admin',
  '/volunteer': 'user',
  '/volunteer-application': 'user',
  '/ingest': 'admin',
}

export interface NativeNavigateOptions {
  params?: Record<string, any>
  clearHistory?: boolean
  backstackVisible?: boolean
}

interface NativeRoute {
  name: string
  path: string
  params: string[]
}

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

function requiredRoleFor(path: string): string | undefined {
  return Object.entries(ROUTE_ROLES)
    .sort(([a], [b]) => b.length - a.length)
    .find(([prefix]) => matchesPrefix(path, prefix))?.[1]
}

/** Does a concrete path (`/events/42`) match a manifest path (`/events/:id`)? */
function matchesPattern(routePath: string, path: string): boolean {
  const pattern = routePath.split('/').filter(Boolean)
  const actual = path.split('/').filter(Boolean)
  if (pattern.length !== actual.length) return false
  return pattern.every((segment, index) => segment.startsWith(':') || segment === actual[index])
}

function notifyUnavailable(target: string): void {
  const message = `“${target}” isn't part of this build yet.`
  const alertFn = (globalThis as any).alert
  if (typeof alertFn === 'function') alertFn(message)
  else console.warn(`[native-nav] ${message}`)
}

export function useNativeNavigate() {
  const router = useNativeRouter()

  function resolve(pathOrName: string): NativeRoute | undefined {
    return router.routes.find(route => route.name === pathOrName)
      ?? router.routes.find(route => route.path === pathOrName)
      ?? router.routes.find(route => matchesPattern(route.path, pathOrName))
  }

  function exists(pathOrName: string): boolean {
    return Boolean(resolve(pathOrName))
  }

  /**
   * Navigate to a route by name or path. Returns `false` (and does not push)
   * when the target is missing from the build, or when the role guard
   * redirected somewhere else instead.
   */
  async function to(target: string, options: NativeNavigateOptions = {}): Promise<boolean> {
    const route = resolve(target)
    if (!route) {
      notifyUnavailable(target)
      return false
    }

    const requiredRole = requiredRoleFor(route.path)
    if (requiredRole) {
      const { refresh: refreshSession } = useSession()
      const session = await refreshSession(true)
      if (!session?.session) {
        return pushByName('auth_login', { clearHistory: true })
      }

      const { roles, refresh: refreshRoles } = useUserRoles()
      await refreshRoles(true)
      if (!roles.value.includes(requiredRole)) {
        return pushByName('unauthorized')
      }
    }

    await router.navigate(route.name, {
      params: options.params,
      clearHistory: options.clearHistory,
      backstackVisible: options.backstackVisible,
    })
    return true
  }

  async function pushByName(name: string, options: NativeNavigateOptions = {}): Promise<boolean> {
    const route = resolve(name)
    if (!route) {
      notifyUnavailable(name)
      return false
    }
    await router.navigate(route.name, {
      params: options.params,
      clearHistory: options.clearHistory,
      backstackVisible: options.backstackVisible,
    })
    return true
  }

  return {
    to,
    back: (options?: any) => router.back(options),
    canGoBack: () => router.canGoBack(),
    exists,
    resolve,
    routes: router.routes as NativeRoute[],
  }
}
