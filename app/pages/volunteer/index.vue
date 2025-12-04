<script setup lang="ts">
const { data: session } = await useAsyncData('session', () =>
  $fetch('/api/auth/get-session').catch(() => null)
);

</script>
<template>
<div class="w-full h-full mt-12 mb-12 px-4 py-6 overflow-y-auto">

    <h1>Welcome {{ session?.user?.email }}</h1>
</div>

</template>