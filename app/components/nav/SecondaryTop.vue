<script setup lang="ts">
const router = useRouter()
</script>

<template>
    <UHeader 
        :ui="{ toggle: 'hidden' }" 
        class="fixed top-0 z-50 h-12 w-full bg-white ">
        <!-- Left back button  -->
        <template #left>
            <div class="">
                <UButton
                    color="neutral"
                    variant="ghost"
                    aria-label="Settings"
                    @click="router.back()">
                    <UIcon name="i-heroicons-arrow-left" class="w-7 h-7 text-teal-900" />
                </UButton>
            </div>
        </template>
        <template #toggle />
    </UHeader>
</template>