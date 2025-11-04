import { resolve } from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@prisma/nuxt',
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
  },
})
