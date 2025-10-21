<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import { loginFormSchema } from "#shared/types/authFormTypes";
import type { LoginFormSchema } from "#imports";

const state = reactive<Partial<LoginFormSchema>>({
    email: undefined,
    password: undefined,
});

const isLoading = ref(false);

async function onSubmit(event: FormSubmitEvent<LoginFormSchema>) {
    isLoading.value = true;
    try {
        await $fetch("/api/auth/login", {
            method: "POST",
            body: {
                email: event.data.email,
                password: event.data.password,
            },
        });
    } finally {
        isLoading.value = false;
    }
}
</script>

<template>
    <div
        class="sm:w-[375px] bg-[#F2EBE3] flex flex-col justify-center h-screen px-8"
    >
        <h1 class="text-black font-bold text-4xl pb-6">Login</h1>
        <UForm
            v-bind:schema="loginFormSchema"
            v-bind:state="state"
            class="space-y-4"
            @submit.prevent="onSubmit"
        >
            <UFormField
                class="text-black text-2xl font-bold"
                label="Email"
                name="email"
                required
            >
                <UInput
                    v-model="state.email"
                    leading-icon="i-lucide-at-sign"
                    color="secondary"
                    variant="soft"
                    size="xl"
                    class="w-full"
                />
            </UFormField>

            <UFormField
                class="text-black text-2xl font-bold"
                label="Password"
                name="password"
                size="xl"
            >
                <UInput
                    v-model="state.password"
                    type="password"
                    class="w-full"
                    variant="soft"
                />
            </UFormField>

            <UButton
                type="submit"
                class="bg-[#a26b61] w-[25%] justify-center"
                size="xl"
                :loading="isLoading"
                :disabled="isLoading"
            >
                <span class="font-bold text-[#a26b61/50]">Login</span>
            </UButton>
        </UForm>
    </div>
</template>
