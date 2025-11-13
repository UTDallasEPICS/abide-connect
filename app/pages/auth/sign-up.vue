<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import type { SignUpSchema } from "~~/shared/types/auth/signUpTypes";
import { signUpFields, signUpSchema } from "~~/shared/types/auth/signUpTypes";
import { authProviders } from "~~/shared/types/auth/providers";

const state = reactive<Partial<SignUpSchema>>({
    name: "",
    email: "",
    password: "",
    phone: "",
    languages: [],
    gender: null,
    ethinicity: null,
    availability: []
});
const errorMessage = ref<string | null>(null);

const isLoading = ref(false);

async function onSubmit(payload: FormSubmitEvent<SignUpSchema>) {
    isLoading.value = true;
    console.log(payload.data);
    try {
        await $fetch("/api/auth/sign-up", {
            method: "POST",
            body: {
                name: payload.data.name,
                email: payload.data.email,
                password: payload.data.password,
                phone: payload.data.phone,
                languages: payload.data.languages,
                gender: payload.data.gender,
                ethinicity: payload.data.ethinicity,
                availability: payload.data.availability,
            },
        });
        await nextTick();
        await navigateTo("/volunteer/");
    } catch (error: any) {
        console.log(error);
        errorMessage.value = error?.message;
    } finally {
        isLoading.value = false;
    }
}
</script>

<template>
    <div class="flex flex-col items-center justify-center p-8 my-8 ">
        <UAuthForm class="w-full max-w-md"
            :schema="signUpSchema"
            :fields="signUpFields"
            :providers="authProviders"
            title="Let's get you started to be a Volunteer!"
            icon="i-lucide-user"
            :separator="{
                icon: 'i-lucide-mail'
            }"  
            :submit="{ label: 'Sign up', block: true, color: 'neutral' }"

            @submit="onSubmit"
        >
        <template #description>
          Already a Volunteer? <ULink to="/auth/login" class="text-primary font-medium">Log In</ULink>.
        </template>
        <template #password-hint>
          <ULink to="#" class="text-primary font-medium" tabindex="-1">Forgot password?</ULink>
        </template>
        <template #validation>
          <UAlert v-if="errorMessage" color="error" icon="i-lucide-info" :title="errorMessage" />
        </template>
        <template #footer>
          By signing in, you agree to our <ULink to="#" class="text-primary font-medium">Terms of Service</ULink>.
        </template>
        </UAuthForm>
    </div>
</template>
