<script setup lang="ts">
definePageMeta({
  layout: 'secondary',
  backTo: '/volunteer',
})
</script>

<template>
  <PageContainer
    width="narrow"
    class="flex flex-1 items-center justify-center"
  >
    <div class="text-center space-y-4">
      <h1 class="text-4xl text-gray-900 dark:text-white">
        Thank You!
      </h1>

      <p class="text-base font-normal text-gray-600 dark:text-gray-300">
        Your volunteer application has been successfully submitted. We appreciate
        your interest in volunteering with us!
      </p>

      <p class="text-base font-normal text-gray-600 dark:text-gray-300">
        Before you can begin volunteering, you must complete the required
        volunteer training. Once your training has been completed, you'll be
        eligible to participate in volunteer opportunities.
      </p>

      <p class="text-base font-normal text-gray-600 dark:text-gray-300">
        You can access the volunteer training page
        <NuxtLink
          to="/volunteer"
          class="text-teal-500 dark:text-teal-400 hover:underline"
        >
          here
        </NuxtLink>.
      </p>
    </div>
  </PageContainer>
</template>
