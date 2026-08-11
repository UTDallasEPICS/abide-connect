/**
 * Client half of Web Push: browser permission + subscription lifecycle,
 * kept in sync with the `push_subscriptions` rows on the server.
 *
 * The server half lives in server/utils/push.ts and server/api/push/*.
 */

/** Push services want the VAPID key as a Uint8Array, not the base64url string. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)))
}

/**
 * - `unknown` — still determining support (SSR, or the service worker hasn't resolved)
 * - `supported` — everything needed is present
 * - `unsupported` — browser can't do Web Push at all
 * - `requires-install` — iOS Safari in a tab: push only works once added to the home screen
 * - `not-configured` — server has no VAPID keys configured
 */
export type PushSupport = 'unknown' | 'supported' | 'unsupported' | 'requires-install' | 'not-configured'

export function usePushNotifications() {
  const config = useRuntimeConfig()
  const vapidPublicKey = config.public.vapidPublicKey as string

  const support = ref<PushSupport>('unknown')
  const permission = ref<NotificationPermission>('default')
  const isSubscribed = ref(false)
  const isBusy = ref(false)

  function detectSupport(): PushSupport {
    if (!import.meta.client) return 'unknown'
    if (!vapidPublicKey) return 'not-configured'

    const hasApis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (hasApis) return 'supported'

    // iOS only exposes PushManager to home-screen web apps. Detect that case
    // specifically so we can tell the user to install rather than "unsupported".
    const isIos = /iP(hone|ad|od)/.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isIos && !isStandalone) return 'requires-install'

    return 'unsupported'
  }

  async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null
    return navigator.serviceWorker.ready
  }

  async function refresh() {
    support.value = detectSupport()
    if (support.value !== 'supported') return

    permission.value = Notification.permission

    const registration = await getRegistration()
    const existing = await registration?.pushManager.getSubscription()
    isSubscribed.value = Boolean(existing)
  }

  /**
   * Asks for permission if needed, creates a push subscription, and registers
   * it server-side. Returns false if the user denied or the browser can't.
   */
  async function subscribe(): Promise<boolean> {
    if (support.value !== 'supported') return false

    isBusy.value = true
    try {
      permission.value = await Notification.requestPermission()
      if (permission.value !== 'granted') return false

      const registration = await getRegistration()
      if (!registration) return false

      // Reuse the device's existing subscription when there is one, so the
      // endpoint (and therefore the server row) stays stable.
      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        })

      await $fetch('/api/push/subscribe', {
        method: 'POST',
        body: subscription.toJSON(),
      })

      isSubscribed.value = true
      return true
    }
    catch (error) {
      console.error('[push] subscribe failed', error)
      return false
    }
    finally {
      isBusy.value = false
    }
  }

  /** Tears down the device subscription and removes it server-side. */
  async function unsubscribe(): Promise<void> {
    isBusy.value = true
    try {
      const registration = await getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      if (!subscription) {
        isSubscribed.value = false
        return
      }

      const { endpoint } = subscription
      await subscription.unsubscribe()
      await $fetch('/api/push/unsubscribe', { method: 'POST', body: { endpoint } })
      isSubscribed.value = false
    }
    catch (error) {
      console.error('[push] unsubscribe failed', error)
    }
    finally {
      isBusy.value = false
    }
  }

  onMounted(refresh)

  return { support, permission, isSubscribed, isBusy, subscribe, unsubscribe, refresh }
}
