import { addServerHandler, createResolver, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'ipx-cache',
  },
  setup() {
    const { resolve } = createResolver(import.meta.url)
    addServerHandler({
      route: '/_ipx/**',
      handler: resolve('./runtime/ipx-cache.ts'),
    })
  },
})
