<script setup>
const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  startTime: {
    type: [String, Date],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  size: {
    type: String,
    default: 'default', // 'default' | 'lg'
  },
  showActions: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['cancel'])

const formattedDateTime = computed(() => {
  const date = new Date(props.startTime)
  const datePart = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  })
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${datePart} • ${timePart}`
})

const menuOpen = ref(false)
const cardRef = ref(null)

const pressed = ref(false)

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function goToEvent() {
  navigateTo(props.url)
}

function handleCancel() {
  menuOpen.value = false
  emit('cancel', props.id)
}

function handleClickOutside(event) {
  if (cardRef.value && !cardRef.value.contains(event.target)) {
    menuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))

const isLarge = computed(() => props.size === 'lg')
</script>

<template>
  <div
    ref="cardRef"
    class="relative"
  >
    <div
      role="link"
      tabindex="0"
      class="relative flex w-full origin-center transform-gpu items-center gap-3 overflow-hidden rounded-2xl border-2 border-gray-300 bg-white text-left shadow-sm transition-[background-color,transform] duration-100 ease-out cursor-pointer hover:bg-gray-50"
      :class="[pressed ? 'scale-[0.97] bg-gray-100' : '', isLarge ? 'p-2.5' : 'p-2']"
      @mousedown="pressed = true"
      @mouseup="pressed = false"
      @mouseleave="pressed = false"
      @touchstart="pressed = true"
      @touchend="pressed = false"
      @click="goToEvent"
      @keydown.enter="goToEvent"
    >
      <div
        class="shrink-0 overflow-hidden rounded-xl"
        :class="isLarge ? 'h-20 w-20' : 'h-16 w-16'"
      >
        <img
          :src="image"
          :alt="title"
          draggable="false"
          class="h-full w-full select-none object-cover"
        >
      </div>
      <div
        class="flex min-w-0 flex-1 flex-col justify-between"
        :class="isLarge ? 'h-20 py-0.5' : 'h-16 py-0.5'"
      >
        <div class="pr-9 space-y-0.5">
          <p class="text-xs font-normal text-blue-600">
            {{ formattedDateTime }}
          </p>
          <h3 class="truncate text-sm font-semibold text-gray-900">
            {{ title }}
          </h3>
        </div>
        <p class="flex items-center gap-1 pr-9 text-xs font-normal text-gray-500">
          <Icon
            name="heroicons:map-pin-20-solid"
            class="h-3.5 w-3.5 shrink-0"
          />
          <span class="truncate">{{ location }}</span>
        </p>
      </div>

      <button
        v-if="showActions"
        type="button"
        class="absolute bottom-2 right-2 z-10 flex h-8 w-9 cursor-pointer items-center justify-center rounded-md bg-transparent text-gray-400 transition-colors duration-100 ease-out hover:text-gray-700"
        @mousedown.stop
        @touchstart.stop
        @click.stop="toggleMenu"
      >
        <Icon
          name="heroicons:ellipsis-horizontal-20-solid"
          class="h-6 w-6"
        />
      </button>
    </div>

    <div
      v-if="showActions && menuOpen"
      class="absolute right-2 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <button
        type="button"
        class="block w-full px-3 py-2 text-left text-sm font-normal text-red-700 transition-colors duration-100 ease-out hover:bg-gray-50 active:bg-gray-100"
        @click.stop="handleCancel"
      >
        Unregister
      </button>
    </div>
  </div>
</template>
