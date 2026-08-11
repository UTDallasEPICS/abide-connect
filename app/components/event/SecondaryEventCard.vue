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
});

const emit = defineEmits(['cancel']);

const formattedDateTime = computed(() => {
  const date = new Date(props.startTime);
  const datePart = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} • ${timePart}`;
});

const menuOpen = ref(false);
const cardRef = ref(null);

// Tracked manually instead of relying on CSS :active — native :active
// bubbles up to this element even when only the ellipsis button (a
// descendant) is pressed, which was causing the whole card to visually
// "press" on ellipsis clicks too.
const pressed = ref(false);

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function goToEvent() {
  navigateTo(props.url);
}

function handleCancel() {
  menuOpen.value = false;
  emit('cancel', props.id);
}

// Close the menu on outside click.
function handleClickOutside(event) {
  if (cardRef.value && !cardRef.value.contains(event.target)) {
    menuOpen.value = false;
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside));
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside));
</script>
<template>
  <div ref="cardRef" class="relative">
    <div
      role="link"
      tabindex="0"
      class="relative flex w-full origin-center transform-gpu items-center gap-3 overflow-hidden rounded-2xl border-2 border-gray-300 bg-white p-2 text-left shadow-sm transition-[background-color,transform] duration-100 ease-out cursor-pointer hover:bg-gray-50"
      :class="pressed ? 'scale-[0.97] bg-gray-100' : ''"
      @mousedown="pressed = true"
      @mouseup="pressed = false"
      @mouseleave="pressed = false"
      @touchstart="pressed = true"
      @touchend="pressed = false"
      @click="goToEvent"
      @keydown.enter="goToEvent"
    >
      <!-- Thumbnail -->
      <div class="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
        <img
          :src="image"
          :alt="title"
          draggable="false"
          class="h-full w-full select-none object-cover"
        />
      </div>
      <!-- Details: date/title pinned top, location pinned bottom -->
      <div class="flex h-16 min-w-0 flex-1 flex-col justify-between py-0.5">
        <div class="space-y-0.5 pr-9">
          <p class="text-xs font-normal text-blue-600">
            {{ formattedDateTime }}
          </p>
          <h3 class="truncate text-sm font-semibold text-gray-900">{{ title }}</h3>
        </div>
        <p class="flex items-center gap-1 pr-9 text-xs font-normal text-gray-500">
          <Icon name="heroicons:map-pin-20-solid" class="h-3.5 w-3.5 shrink-0" />
          <span class="truncate">{{ location }}</span>
        </p>
      </div>

      <!-- Ellipsis menu trigger — transparent so it always shows the card's
           actual background underneath, no matter its hover/press state.
           mousedown/touchstart are stopped so pressing it never triggers
           the card's own press animation. -->
      <button
        type="button"
        class="absolute bottom-2 right-2 z-10 flex h-8 w-9 cursor-pointer items-center justify-center rounded-md bg-transparent text-gray-400 transition-colors duration-100 ease-out hover:text-gray-700"
        @mousedown.stop
        @touchstart.stop
        @click.stop="toggleMenu"
      >
        <Icon name="heroicons:ellipsis-horizontal-20-solid" class="h-6 w-6" />
      </button>
    </div>

    <!-- Dropdown menu — opens downward, below the trigger -->
    <div
      v-if="menuOpen"
      class="absolute right-2 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <button
        type="button"
        class="block w-full px-3 py-2 text-left text-sm font-normal text-red-600 transition-colors duration-100 ease-out hover:bg-gray-50 active:bg-gray-100"
        @click.stop="handleCancel"
      >
        Cancel Sign Up
      </button>
    </div>
  </div>
</template>