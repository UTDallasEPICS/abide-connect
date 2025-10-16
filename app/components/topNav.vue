<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const logo = '/images/abide_logo.svg'
const handleLogo = async () => {
    await router.push('/') 
}
</script>

<template>
    <link rel="preload" as="image" :href="logo" />
    <UHeader :ui="{ toggle: 'hidden' }" class="sticky top-0 z-50 h-12 bg-white/90 backdrop-blur border-b">
        <!-- Left Settings -->
        <template #left>
            <div class="">
                <UButton    
                    color="neutral"
                    variant="ghost"
                    aria-label="Settings">
                    <UIcon name="i-heroicons-cog-6-tooth" class="w-7 h-7" />
                </UButton>
            </div>
        </template>
        <!-- Center Logo -->
        <template #default>
            <div class="flex items-center justify-center flex-1">
                <button @click="handleLogo" class="focus:outline-none cursor-pointer flex items-center" 
                    :class="{ 'cursor-default': route.path === '/' }" type="button">
                    <img :src="logo" alt="Abide Connect" class="h-8 w-auto" /> 
                </button>
            </div>
        </template>

        <!-- Right Inbox -->
        <template #right>
            <div class="w-10 flex items-center justify-end">
                <UButton
                    color="neutral"
                    variant="ghost"
                    aria-label="Inbox" >
                    <UIcon name="i-heroicons-inbox" class="w-7 h-7" />
                </UButton>
            </div>
        </template>
        <template #toggle />
    </UHeader>
</template>