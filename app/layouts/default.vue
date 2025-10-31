<template>
    <div class="min-h-screen bg-gray-100 flex justify-center py-6">
        <!-- Phone container -->
        <div
            class="w-[375px] bg-[#F2EBE3] rounded-3xl shadow-lg overflow-hidden flex flex-col flex flex-col h-screen overflow-y-auto">


            <!-- Top bar -->
            <TopNav />


            <slot />

            <!-- Bottom nav -->
           <BottomNav />
        </div>
    </div>
</template>