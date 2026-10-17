import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { isNativeApp, takeNativeVerifier } from '~/lib/nativeApp'
import { resolveLandingRoute } from '~/lib/landingRoute'
import { NATIVE_AUTH_CALLBACK } from '#shared/utils/nativeApp'

/**
 * Native-app glue that has to be listening on every page, not just the one
 * that started something: the end of the system-browser Google sign-in.
 *
 * The browser returns to the app on `NATIVE_AUTH_CALLBACK` with a token; this
 * redeems it with the verifier `beginNativeHandoff` kept, which sets the
 * session cookie in the WebView. A cold start (Android can kill the app while
 * the browser is up) delivers the same URL as the launch URL instead of an
 * event, so both are handled.
 *
 * A no-op in a browser.
 */
export default defineNuxtPlugin(() => {
  if (!isNativeApp()) return

  async function finishSignIn(url: string) {
    if (!url.startsWith(NATIVE_AUTH_CALLBACK)) return
    await Browser.close().catch(() => {}) // already closed on a cold start

    const token = new URL(url).searchParams.get('token')
    const verifier = takeNativeVerifier()
    try {
      if (!token || !verifier) throw new Error('missing handoff state')
      const { roles } = await $fetch<{ roles: string[] }>('/api/auth/native/redeem', {
        method: 'POST',
        body: { token, verifier },
      })
      await navigateTo(await resolveLandingRoute(undefined, roles), { replace: true })
    }
    catch {
      await navigateTo({ path: '/auth/staff-login', query: { failed: '1' } }, { replace: true })
    }
  }

  App.addListener('appUrlOpen', ({ url }) => finishSignIn(url))
  App.getLaunchUrl().then(launch => launch && finishSignIn(launch.url))
})
