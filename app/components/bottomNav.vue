<script setup lang="ts">
const nav = ref([
    {
        id: 1,
        icon: "i-lucide-house",
        label: "Home",
        to: "/home",
    },
    {
        id: 2,
        icon: "i-lucide-calendar-days",
        label: "Events",
        to: "/home",
    },{
        id: 3,
        icon: "i-lucide-hospital",
        label: "Clinic",
        to: "/mobileClinic",
    },
    {
        id: 4,
        icon: "i-lucide-square-user-round",
        label: "Volunteer",
        to: "/volunteer",
    },
    
    
]);
</script>
<template>
 <UFooter class="fixed bottom-0 left-0 right-0 flex justify-around items-center h-13 bg-white">
   <template #default>


     <div
       v-for="item in nav"
       :key="item.id"
       class="flex flex-col items-center justify-center w-full"
     >
       <!-- your existing button, unchanged -->
       <UButton
         :icon="item.icon"
         :to="item.to"
         color="neutral"
         variant="ghost"
         class="h-full mx-7"
       />


       <span class="text-[10px] leading-none text-gray-600 mt-0.5">
         {{ item.label }}
       </span>
     </div>


   </template>
 </UFooter>
</template>
