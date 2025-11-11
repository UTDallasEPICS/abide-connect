import { resolve } from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@prisma/nuxt',
    'nuxt-maplibre'
  ],

  // ✅ Use an explicit relative path instead of @ or ~
  css: [resolve('./assets/css/main.css')],

  vite: {
    plugins: [tsconfigPaths()],
    resolve: {
      alias: {
        '@': resolve('./'),
        '~': resolve('./'),
      },
    },
    optimizeDeps: {
      include: ['maplibre-gl'],
    },
  },
 
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
        'brand7'
      ]
    }
  }
})
