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
