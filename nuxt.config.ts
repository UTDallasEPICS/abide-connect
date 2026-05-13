// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    'nuxt-maplibre',
    '@vite-pwa/nuxt',
  ],
  devtools: {
    enabled: true,
  },
  css: [
    '~/assets/css/main.css',
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
      ],
    },
  },
  compatibilityDate: '2025-07-15',
  vite: {
    optimizeDeps: {
      include: ['maplibre-gl', 'vue3-carousel'],
    },
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
      navigateFallbackAllowlist: [/^\/(?!api)/],
    },
    devOptions: {
      enabled: false,
      type: 'module',
    },
  },
})
