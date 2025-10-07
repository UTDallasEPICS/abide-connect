<script setup>
const router = useRouter()
onMounted(() => {
  router.push('/home')
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <h1 class="text-3xl font-bold text-blue-600">🚀 Nuxt is working!</h1>
  </div>
</template>