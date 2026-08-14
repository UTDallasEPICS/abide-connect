<script setup lang="ts">
/**
 * One headline number, optionally with a change against a named period.
 *
 * The delta's colour is direction × whether up is good, which is why
 * `upIsGood` exists as a prop: a rising number of hours is good news and a
 * rising approval backlog is not, and painting both green because they both
 * went up is how a dashboard trains people to stop reading it. Where direction
 * carries no judgement at all, leave `upIsGood` unset and the delta stays ink.
 */

const props = withDefaults(defineProps<{
  label: string
  value: string
  /** Sits under the value — the median beside the mean, the count behind a rate. */
  detail?: string
  icon?: string
  /** Signed percentage change. */
  deltaPct?: number | null
  deltaLabel?: string
  upIsGood?: boolean | null
  /** Renders at hero size. Exactly one per page. */
  hero?: boolean
}>(), {
  upIsGood: null,
})

const deltaTone = computed(() => {
  if (props.deltaPct === null || props.deltaPct === undefined || props.upIsGood === null) {
    return 'text-slate-600 dark:text-gray-400'
  }
  if (Math.abs(props.deltaPct) < 0.05) return 'text-slate-600 dark:text-gray-400'

  const good = (props.deltaPct > 0) === props.upIsGood
  return good
    ? 'text-[var(--viz-good)]'
    : 'text-[var(--viz-critical)]'
})

const deltaIcon = computed(() => {
  if (props.deltaPct === null || props.deltaPct === undefined) return null
  if (Math.abs(props.deltaPct) < 0.05) return 'i-lucide-minus'
  return props.deltaPct > 0 ? 'i-lucide-trending-up' : 'i-lucide-trending-down'
})
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-4 shadow-sm"
  >
    <div class="flex items-center gap-2">
      <UIcon
        v-if="icon"
        :name="icon"
        class="w-4 h-4 text-slate-500 dark:text-gray-400 shrink-0"
      />
      <p class="text-xs sm:text-sm font-medium text-slate-600 dark:text-gray-400 truncate">
        {{ label }}
      </p>
    </div>

    <!-- Proportional figures, not tabular: these are standalone display
         numbers, and equal-width digits make them look loose at this size. -->
    <p
      class="font-bold text-[#313131] dark:text-white mt-1.5"
      :class="hero ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl'"
    >
      {{ value }}
    </p>

    <p
      v-if="detail"
      class="text-xs font-medium text-slate-500 dark:text-gray-400 mt-1"
    >
      {{ detail }}
    </p>

    <p
      v-if="deltaPct !== null && deltaPct !== undefined"
      class="flex items-center gap-1 mt-2 text-xs font-semibold"
      :class="deltaTone"
    >
      <UIcon
        v-if="deltaIcon"
        :name="deltaIcon"
        class="w-3.5 h-3.5 shrink-0"
      />
      <span>{{ deltaPct > 0 ? '+' : '' }}{{ deltaPct.toFixed(1) }}%</span>
      <span
        v-if="deltaLabel"
        class="font-medium text-slate-500 dark:text-gray-400 truncate"
      >{{ deltaLabel }}</span>
    </p>
  </div>
</template>
