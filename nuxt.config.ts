// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@prisma/nuxt'
  ],
  css: ['~/assets/css/main.css'],
  eslint: {
    // additional options here
  },
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
        'brand7'
      ]
    }
  }
})