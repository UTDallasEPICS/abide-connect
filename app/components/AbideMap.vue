<template>
  <ClientOnly>
    <MglMap
      :map-style="style"
      :center="center"
      :zoom="zoom"
      :attribution-control="false"
      >
      <!--<MglNavigationControl />-->
      <MglMarker
        :coordinates="[center[0], center[1]]"
        color="#FF0000"
        />
    </MglMap>
  </ClientOnly>
</template>

<script lang="ts" setup>
defineProps<{
  style: string;
  center: [number, number];
  zoom: number;
}>();
</script>
