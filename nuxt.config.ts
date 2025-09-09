// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/eslint',
    '@nuxtjs/tailwindcss',
    '@prisma/nuxt'
  ],
  // vite: {
  //   resolve: {
  //     alias: {
  //       '.prisma/client/index-browser': './node_modules/.prisma/client/index-browser.js',
  //     },
  //   },
  // },
  eslint: {
    // additional options here
  }
})
