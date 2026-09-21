// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    'nuxt-maplibre',
    '@vite-pwa/nuxt',
    'nuxt-cron',
  ],
  devtools: {
    enabled: true,
  },
  css: [
    '~/assets/css/main.css',
    '~/assets/css/carousel-theme.css',
  ],
  ui: {
    theme: {
      colors: [
        'primary',
        'secondary',
        'info',
        'success',
        'warning',
        'neutral',
        'error',
        'brand1',
        'brand2',
        'brand3',
        'brand4',
        'brand5',
        'brand6',
        'brand7',
        'brand8',
        'brand9',
      ],
    },
  },

  runtimeConfig: {
    public: {
      // VAPID public key, needed client-side to create a push subscription.
      // Safe to expose — the private key stays on the server (server/utils/push.ts).
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    },
  },

  /**
   * Response caching for the parts of the app that are the same for everybody.
   *
   * `swr` caches the rendered response and serves it to every caller for the
   * TTL, so a new event shows up within the TTL rather than instantly — that
   * is the trade being made here, and it is why the TTLs are short.
   *
   * IMPORTANT: the cache key is the URL. It does not include the session
   * cookie, so anything whose body varies by who is asking must NOT be listed
   * here or one caller's response gets replayed to the next. That rules out
   * `/api/events` and `/api/events/list` and `/api/events/:id` (audience
   * filtered through `getEventViewer` — volunteer-only and training events),
   * everything under `/api/events/:id/rsvp|my-rsvp|time-slots`, all of
   * `/api/auth/*` and `/api/user/*`, and the `/events/*` pages, which SSR the
   * viewer's roles and RSVP state. Hence the explicit list below instead of a
   * `/api/events/**` glob.
   */
  routeRules: {
    // Public event feeds: no session read, no audience filtering.
    '/api/events/upcoming': { swr: 60 },
    '/api/events/today': { swr: 60 },
    '/api/events/week': { swr: 60 },
    '/api/events/by-day': { swr: 60 },
    '/api/events/training': { swr: 60 },
    '/api/mobile-clinic/schedule': { swr: 60 },

    // The landing page fetches everything session-dependent client-side
    // (`server: false` in app/pages/index.vue), so its HTML is the same for a
    // signed-in and a signed-out visitor.
    '/': { swr: 60 },
    // mobileClinic.vue does all of its fetching in onMounted.
    '/mobileClinic': { swr: 300 },
  },
  compatibilityDate: '2025-07-15',

  nitro: {
    externals: {
      // web-push and its ASN.1 dependencies are CommonJS. Left external,
      // Nitro's dev server loads them through Node's ESM loader and every
      // server route dies at module-compile time. Bundling the whole tree
      // lets Rollup apply CJS interop consistently.
      inline: ['web-push', 'asn1.js', 'bn.js'],
    },
  },
  vite: {
    optimizeDeps: {
      include: ['maplibre-gl', 'vue3-carousel', 'better-auth/vue', 'zod', '@internationalized/date'],
    },
  },
  cron: {
    runOnInit: true,
    timeZone: 'America/Chicago',
    jobsDir: 'cron',
  },
  eslint: {
    config: {
      stylistic: true,
    },
  },


  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Abide Connect',
      short_name: 'Abide',
      description: 'Abide Women\'s Health Volunteer App',
      theme_color: '#00786F',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      id: '/',
      start_url: '/',
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],

      /* screenshots: [
    {
      src: '/images/image1.jpeg',   // ← use your existing image
      sizes: '540x720',
      type: 'image/jpeg',
      form_factor: 'narrow'         // ← for mobile
    },
    {
      src: '/images/image1.jpeg',
      sizes: '720x540',
      type: 'image/jpeg',
      form_factor: 'wide'           // ← for desktop
    }
  ] */

    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      maximumFileSizeToCacheInBytes: 4194304,
      // push-sw.js is imported into the service worker below, so it must not
      // also be precached as a page asset.
      globIgnores: ['**/push-sw.js'],
      navigateFallbackAllowlist: [/^\/(?!api)/],
      // Adds the Web Push `push` / `notificationclick` handlers to the
      // generated Workbox service worker. See public/push-sw.js.
      importScripts: ['/push-sw.js'],
    },
    devOptions: {
      enabled: false,
      type: 'module',
    },
  },
})
