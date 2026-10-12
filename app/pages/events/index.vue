<template>
  <DefaultLayout title="Events">
    <StackLayout :style="{ padding: spacing.lg }">
      <NText variant="h2" text="Events" :style="{ marginBottom: spacing.sm }" />
      <NButton text="Go to events/list" @tap="goList" />
    </StackLayout>
  </DefaultLayout>
</template>

<script setup lang="ts">
import DefaultLayout from '~/layouts/default.vue'
import { spacing } from 'nuxt-native/runtime/theme.js'
import { useNativeNavigate } from '~/composables/useNativeNavigate'
const { to } = useNativeNavigate()
function goList() {
  const ok = to('/events/list')
  console.log('nav:', ok)
}
</script>
