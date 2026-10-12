<template>
  <NPage title="Abide Connect">
    <GridLayout rows="*">
      <StackLayout
        verticalAlignment="center"
        horizontalAlignment="center"
        :style="{ padding: 24 }"
      >
        <NText
          text="Abide Connect"
          :style="{ fontSize: 28, fontWeight: 'bold', textAlignment: 'center', marginBottom: 8 }"
        />
        <NText
          text="Native smoke build"
          :style="{ fontSize: 16, textAlignment: 'center', marginBottom: 24 }"
        />
        <NText
          :text="`Taps: ${count}`"
          :style="{ fontSize: 20, textAlignment: 'center', marginBottom: 16 }"
        />
        <NButton text="Tap me" @tap="count++" />
      </StackLayout>
    </GridLayout>
  </NPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
</script>
