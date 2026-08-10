<script setup lang="ts">
/**
 * Compact event row used in list views.
 *
 * Emits two separate events because the row has two targets: `click` for the
 * row itself (open the event) and `add` for the trailing button (RSVP, or add
 * to a selection). The button's handler is `@click.stop` so pressing it doesn't
 * also fire the row's navigation.
 */
defineEmits(['add', 'click'])
const props = defineProps<{
  title?: string
  subtitle?: string
  buttonType?: 'plus' | 'arrow'
  eventId?: string
  imageUrl?: string
}>()

const iconName = computed(() =>
  props.buttonType === 'arrow'
    ? 'i-heroicons-arrow-right-20-solid'
    : 'i-heroicons-plus',
)

// Unused — callers pass a ready-made `imageUrl` prop instead. Safe to remove.
function getAssetUrl(imageUrl: string) {
  return `/api/events/${imageUrl}`
}
</script>

<template>
  <div
    class="flex items-center gap-4 rounded-[22px] border border-gray-800/70 dark:border-gray-700/60
           bg-white/70 dark:bg-gray-900/60 backdrop-blur px-4 py-3 shadow-sm cursor-pointer
           hover:shadow-md transition-shadow"
    @click="$emit('click')"
  >
    <!-- Event image or placeholder -->
    <div class="h-12 w-12 rounded-2xl bg-gray-300/70 dark:bg-gray-600/60 border border-gray-800/60 flex-shrink-0 overflow-hidden">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        alt="Event image"
        class="w-full h-full object-cover"
      >
      <span
        v-else
        class="flex items-center justify-center h-full text-xl"
      >📅</span>
    </div>

    <!-- Text lines -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
        {{ title }}
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
        {{ subtitle }}
      </p>
    </div>

    <!-- Action button -->
    <button
      class="grid place-items-center rounded-xl h-9 w-9 flex-shrink-0 border border-gray-800/70 dark:border-gray-700/60
             hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition"
      type="button"
      @click.stop="$emit('add')"
    >
      <UIcon
        :name="iconName"
        class="w-5 h-5"
      />
    </button>
  </div>
</template>
