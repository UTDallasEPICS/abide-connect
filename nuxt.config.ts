// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint', 'nuxt-maplibre'],
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  // css: ['assets/css/main.css']
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
      include: ['maplibre-gl'],
    },
  },
  eslint: {
    checker: true,
    config: {
      stylistic: true,
    },
  },
})
