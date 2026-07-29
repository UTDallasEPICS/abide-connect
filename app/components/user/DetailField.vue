<script setup lang="ts">
import type { InputMenuItem } from '@nuxt/ui';
import { computed } from 'vue';

type FieldType = 'text' | 'tel' | 'date' | 'number' | 'select';

interface FieldOption {
  label: string;
  value: string;
}

const props = withDefaults(defineProps<{
  label: string
  value?: string | number | string[] | null
  editable?: boolean
  type?: FieldType
  multiple?: boolean,
  modelValue?: string | number
  options?: InputMenuItem[]
  autocomplete?: string
}>(), {
  editable: false,
  type: 'text',
});

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>();

const fieldOptions = computed<FieldOption[]>(() => {
  if (props.options) {
    return props.options.map((inputMenuItem) => ({
      value: inputMenuItem.id,
      label: inputMenuItem.label,
    }));
  }

  return [];
});

</script>
<template>
  <div class="mb-4">
    <h2 class="text-teal-700 font-bold">{{ label }}</h2>

    <USelect
      v-if="editable && type === 'select'"
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
      {{ Array.isArray(value) ? (value.length ? value.join(', ') : '-') : (value ?? '-') }}
    </p>
  </div>
</template>