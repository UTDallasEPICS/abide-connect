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
        Volunteer Application Required
      </h1>

      <p class="text-base font-normal text-gray-600 dark:text-gray-300">
        You must submit a volunteer application before you can access this page
        or sign up to volunteer for events.
      </p>

      <p class="text-base font-normal text-gray-600 dark:text-gray-300">
        Once your application has been submitted and reviewed, you'll be able to
        complete the required volunteer training and register for volunteer
        opportunities.
      </p>

      <p class="text-base font-normal text-gray-600 dark:text-gray-300">
        Submit your application
        <NuxtLink
          to="/volunteer-application"
          class="text-teal-500 dark:text-teal-400 hover:underline"
        >
          here
        </NuxtLink>.
      </p>
    </div>
  </PageContainer>
</template>
