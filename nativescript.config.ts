import type { NativeScriptConfig } from '@nativescript/core'

export default {
  id: "org.abidewomen.connect",
  appPath: '.nuxt-native',
  appResourcesPath: 'App_Resources',
  main: ".nuxt-native/app.js",
  bundlerConfigPath: "webpack.config.cjs",
  webpackConfigPath: "webpack.config.cjs",
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none'
  }
} satisfies NativeScriptConfig
