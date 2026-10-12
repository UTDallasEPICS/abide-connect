<script setup lang="ts">
/**
 * Back button - migrated for NativeScript
 */
const router = useRouter()
const route = useRoute()

function goBack() {
  navigateTo(route.meta.backTo ?? '/')
}
</script>

<template>
  <Button
    text="Back"
    class="back-button"
    :aria-label="route.meta.backText ? `Back to ${route.meta.backText}` : 'Go back'"
    @tap="goBack"
  />
</template>
