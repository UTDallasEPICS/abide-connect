<template>
  <DefaultLayout title="All Events">
    <ScrollView>
      <StackLayout :style="{ padding: spacing.lg }">
        <NText variant="h2" text="All Events" :style="{ marginBottom: spacing.sm }" />
        <NText variant="caption" :text="`Events (${events.length})`" :style="{ marginBottom: spacing.md }" />
        <NButton text="Refresh" @tap="load" :style="{ marginBottom: spacing.md }" />
        <NCard v-for="event in events" :key="event.id" :style="{ marginBottom: spacing.md }">
          <StackLayout>
            <NText variant="h3" :text="event.title" :style="{ marginBottom: spacing.xs }" />
            <NText variant="caption" :text="event.startTime" :style="{ marginBottom: spacing.xs }" />
            <NText variant="caption" :text="event.location" :style="{ marginBottom: spacing.xs }" />
          </StackLayout>
        </NCard>
        <NText v-if="loading" text="Loading..." />
        <NText v-if="error" :text="error" :style="{ color: colors.danger }" />
      </StackLayout>
    </ScrollView>
  </DefaultLayout>
</template>

<script setup lang="ts">
import DefaultLayout from '~/layouts/default.vue'
import { spacing, colors } from 'nuxt-native/runtime/theme.js'
import { apiFetch } from '~/lib/api'

const events = ref<any[]>([])
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await apiFetch<any>('/api/events/list', { query: { filter: 'all', page: 1, limit: 10 } })
    events.value = res?.events || []
  } catch (e: any) {
    error.value = e?.message || 'Failed'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
