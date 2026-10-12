<template>
  <DefaultLayout title="All Events">
    <ScrollView>
      <StackLayout :style="{ padding: spacing.lg }">
        <NText variant="h2" text="All Events" :style="{ marginBottom: spacing.sm }" />
        <NButton text="Refresh" @tap="load" :style="{ marginBottom: spacing.md }" />
        <StackLayout v-if="loading" :style="{ alignItems: 'center', padding: spacing.lg }">
          <NSpinner size="lg" />
        </StackLayout>
        <NText v-else-if="error" :color="colors.danger" :text="error" :style="{ marginBottom: spacing.md }" />
        <StackLayout v-else>
          <NCard v-for="event in events.slice(0, 10)" :key="event.id" :style="{ marginBottom: spacing.md }">
            <StackLayout>
              <NText variant="h3" :text="event.title || 'Untitled'" :style="{ marginBottom: spacing.xs }" />
              <NText variant="caption" :text="formatDateTime(event.startTime)" :style="{ marginBottom: spacing.xs }" />
              <NText variant="caption" :text="event.location" :style="{ marginBottom: spacing.xs }" />
            </StackLayout>
          </NCard>
          <NText v-if="events.length === 0" text="No events found." :style="{ alignSelf: 'center', padding: spacing.md }" />
        </StackLayout>
      </StackLayout>
    </ScrollView>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
    const res: any = await apiFetch('/api/events/list')
    events.value = res?.events || []
  } catch (e: any) {
    error.value = String(e?.message || e || 'Error')
  } finally {
    loading.value = false
  }
}

onMounted(load)

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch {
    return iso
  }
}
</script>
