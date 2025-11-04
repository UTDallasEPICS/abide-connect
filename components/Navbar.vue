<script setup>
import '@progress/kendo-theme-default/dist/all.css'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { BottomNavigation } from '@progress/kendo-vue-layout'
import { inboxIcon, calendarIcon, userIcon } from '@progress/kendo-svg-icons'

const router = useRouter()
const selected = ref(0)

const items = ref([
  { text: 'Home', id: 1, svgIcon: inboxIcon, data: { path: '/' }, selected: true },
  { text: 'Calendar', id: 2, svgIcon: calendarIcon, data: { path: '/' } },
  { text: 'Profile', id: 3, svgIcon: userIcon, data: { path: '/' } },
])

const computedItems = computed(() =>
  items.value.map((item, index) => ({
    ...item,
    selected: index === selected.value,
  }))
)

function onSelect(e) {
  selected.value = e.itemIndex
  router.push(e.itemTarget.data.path)
}
</script>

<template>
  <BottomNavigation
    :items="computedItems"
    @select="onSelect"
    :position-mode="'fixed'"
    class="custom-bottom-nav"
  />
</template>

<style>
.custom-bottom-nav {
  position: absolute !important;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  background-color: white;
  border-top: 1px solid #e5e7eb;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

/* Icon and text tweaks */
.k-bottom-nav .k-icon {
  width: 18px;
  height: 18px;
}

.k-bottom-nav .k-bottom-nav-item-text {
  font-size: 12px;
  color: #4b5563;
}

.k-bottom-nav .k-bottom-nav-item.k-selected .k-bottom-nav-item-text,
.k-bottom-nav .k-bottom-nav-item.k-selected .k-icon {
  color: #0d9488;
}
</style>
