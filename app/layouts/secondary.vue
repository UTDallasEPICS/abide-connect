<template>
    <div class="w-screen h-screen bg-gray-100 items-center">
        <UHeader :ui="{ toggle: 'hidden' }" class="fixed top-0 z-50 h-12 w-full bg-white backdrop-blur ">
            <!-- Left Settings -->
            <template #left>
                <div class="">
                    <UButton color="neutral" variant="ghost" aria-label="Back">
                        <UIcon name="i-lucide-arrow-left-to-line" class="w-7 h-7" />
                    </UButton>
                </div>
            </template>
        </UHeader>
        <slot />
    </div>
</template>