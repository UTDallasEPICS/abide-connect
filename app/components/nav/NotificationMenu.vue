<script setup lang="ts">
/**
 * Notification menu - simplified for NativeScript MVP
 * Original had Popover with complex UI; simplified for native
 */
const open = ref(false)
const expandedId = ref<string | null>(null)
const notifications = ref<any[]>([])
const unreadCount = computed(() => notifications.value.filter(n => !n.isRead).length)

function toggleOpen() {
  open.value = !open.value
}
</script>

<template>
  <Button
    :text="unreadCount > 0 ? `(${unreadCount})` : ''"
    @tap="toggleOpen"
  />
</template>
