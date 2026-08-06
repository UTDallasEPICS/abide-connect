<script setup lang="ts">
import type { InputMenuItem } from '@nuxt/ui';
import { computed } from 'vue';
type FieldType = 'text' | 'tel' | 'date' | 'number' | 'select' | 'checkbox';
interface FieldOption {
  label: string;
  value: string;
}
const props = withDefaults(defineProps<{
  label: string
  value?: string | number | boolean | string[] | null
  editable?: boolean
  type?: FieldType
  multiple?: boolean,
  modelValue?: string | number | boolean
  options?: InputMenuItem[]
  autocomplete?: string
}>(), {
  editable: false,
  type: 'text',
});
const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean]
}>();
const fieldOptions = computed<FieldOption[]>(() => {
  if (props.options) {
    return props.options.map((inputMenuItem) => ({
      value: String(inputMenuItem.value ?? inputMenuItem.id),
      label: inputMenuItem.label as string,
    }));
  }
  return [];
});
const isEmpty = computed(() => {
  const v = props.value;
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'string') return v.trim() === '';
  return false;
});
// Maps a raw enum value to its human label via `options`, if available.
function toLabel(v: string): string {
  const match = fieldOptions.value.find((o) => o.value === v);
  return match ? match.label : v;
}
const displayText = computed(() => {
  if (isEmpty.value) return '-';
  if (Array.isArray(props.value)) return props.value.map((v) => toLabel(v)).join(', ');
  if (typeof props.value === 'boolean') return props.value ? 'Yes' : 'No';
  if (typeof props.value === 'string' && fieldOptions.value.length) return toLabel(props.value);
  return props.value;
});
</script>
<template>
  <div class="mb-4">
    <h2 class="text-teal-700 font-bold">{{ label }}</h2>
    <UCheckbox
      v-if="editable && type === 'checkbox'"
      :model-value="!!modelValue"
      @update:model-value="(v) => emit('update:modelValue', !!v)"
    />
    <USelect
      v-else-if="editable && type === 'select'"
      :model-value="modelValue"
      :items="fieldOptions"
      :multiple="multiple"
      class="w-full max-w-100"
      @update:model-value="(v) => emit('update:modelValue', v as string)"
    />
    <UInput
      v-else-if="editable"
      :type="type"
      :model-value="modelValue"
      :autocomplete="autocomplete"
      class="w-full max-w-100"
      @update:model-value="(v) => emit('update:modelValue', type === 'number' ? Number(v) : (v as string))"
    />
    <p v-else class="font-normal">
      {{ displayText }}
    </p>
  </div>
</template>