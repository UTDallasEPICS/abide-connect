<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const logId = route.params.id  
</script>

<template> 
    <div class="flex flex-col w-screen min-h-screen bg-slate-50 p-15">
        <h1 class="text-2xl font-bold">
            Log Details for {{ logId }}
        </h1>
        <div class="mt-6 bg-white p-6 rounded-xl shadow-sm">
        </div>
    </div>
</template>