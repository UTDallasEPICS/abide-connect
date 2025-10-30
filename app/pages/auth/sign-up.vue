<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import type { SignUpFormSchema } from "#shared/types/authFormTypes";
import { signUpFormSchema } from "#shared/types/authFormTypes";
import { Language } from "@prisma/client";
import type { InputMenuItem } from "@nuxt/ui";

const state = reactive<Partial<SignUpFormSchema>>({
    name: undefined,
    email: undefined,
    password: undefined,
    phone: undefined,
    language: [],
});

const isLoading = ref(false);
const languageItems = ref<InputMenuItem[]>(
    Object.keys(Language).map((language) => ({
        id: language,
        label:
            language.toString().charAt(0).toUpperCase() +
            language.toString().slice(1).toLowerCase(),
    }))
);

async function onSubmit(event: FormSubmitEvent<SignUpFormSchema>) {
    isLoading.value = true;
    console.log(event.data);
    try {
        await $fetch("/api/auth/sign-up", {
            method: "POST",
            body: {
                name: event.data.name,
                email: event.data.email,
                password: event.data.password,
                phone: event.data.phone,
                languages: event.data.language,
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
        <h1 class="text-black font-bold text-4xl pb-6">Sign Up</h1>
        <UForm
            v-bind:schema="signUpFormSchema"
            v-bind:state="state"
            class="space-y-4"
            @submit.prevent="onSubmit"
        >
            <UFormField
                class="text-black text-2xl font-bold"
                label="Name"
                name="name"
            >
                <UInput
                    v-model="state.name"
                    leading-icon="i-lucide-circle-user"
                    color="secondary"
                    variant="soft"
                    size="xl"
                    class="w-full"
                />
            </UFormField>

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
                required
            >
                <UInput
                    v-model="state.password"
                    leading-icon="i-lucide-lock-keyhole"
                    type="password"
                    class="w-full"
                    variant="soft"
                />
            </UFormField>

            <UFormField
                class="text-black text-2xl font-bold"
                label="Phone"
                name="phone"
            >
                <UInput
                    v-model="state.phone"
                    leading-icon="i-lucide-phone"
                    color="secondary"
                    variant="soft"
                    size="xl"
                    class="w-full"
                />
            </UFormField>

            <UFormField
                class="text-black text-2xl font-bold"
                label="Language"
                name="language-multi"
                required
            >
                <UInputMenu
                    v-model="state.language"
                    leading-icon="i-lucide-languages"
                    multiple
                    :items="languageItems"
                    value-key="id"
                    color="secondary"
                    variant="soft"
                    size="xl"
                    class="w-full"
                />
            </UFormField>

            <UButton
                type="submit"
                class="bg-[#a26b61] w-[25%] justify-center"
                size="xl"
                :loading="isLoading"
                :disabled="isLoading"
            >
                <span class="font-bold text-[#a26b61/50]">Sign Up</span>
            </UButton>
        </UForm>
    </div>
</template>
