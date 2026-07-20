<script setup lang="ts">
interface Props {
  name: string
  src?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  src: undefined
})

const initials = computed(() => {
  return props.name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
})

// Treat undefined, null, and empty string as "no image"
const hasImage = computed(() => !!props.src)
</script>

<template>
  <!--
    Sizing note: this component takes up 100% of whatever box its parent gives it.
    Control the actual size from the parent, e.g. <div class="w-10 h-10"><UserAvatar ... /></div>
    [container-type:inline-size] lets the initials font-size scale with the box's own width via cqw units.
  -->
  <img
    v-if="hasImage"
    :src="src!"
    :alt="name"
    class="w-full h-full aspect-square rounded-full object-cover shrink-0"
  >
  <div
    v-else
    class="w-full h-full aspect-square rounded-full flex items-center justify-center font-semibold shrink-0 bg-gray-200 text-gray-600 [container-type:inline-size]"
  >
    <span class="text-[40cqw] leading-none">{{ initials }}</span>
  </div>
</template>