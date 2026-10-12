import { createApp } from 'nativescript-vue'
import { applyLabelClippingFix } from 'nuxt-native/runtime/label-clipping-fix.js'
import RootFrame from './root-frame.vue'


applyLabelClippingFix()

createApp(RootFrame)

  .start()
