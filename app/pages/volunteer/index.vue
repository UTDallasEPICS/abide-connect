<script setup lang="ts">
import { authClient } from '~~/server/utils/auth-client';
import { relativeFetch } from '@/lib/relativeFetch';

const { data: session } = await authClient.useSession(relativeFetch);
console.log(session);

</script>
<template>
    <div class="flex-1 mt-12 mb-12 w-full h-full overflow-y-auto bg-white">
        <h1>Volunteer</h1>
    </div>
</template>