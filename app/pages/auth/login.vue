<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import type { LoginSchema } from "~~/shared/types/auth/loginTypes";
import { loginFields, loginSchema } from "~~/shared/types/auth/loginTypes";
import { authProviders } from "~~/shared/types/auth/providers";


const state = reactive<Partial<LoginSchema>>({
    email: undefined,
    password: undefined,
});

const isLoading = ref(false);

async function onSubmit(event: FormSubmitEvent<LoginSchema>) {
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
        class="flex flex-col items-center justify-center h-screen p-8 mt-8"
    >
    <UAuthForm class="w-full max-w-md"
        :schema="loginSchema"
        :fields="loginFields"
        :providers="authProviders"
        title="Welcome back!"
        icon="i-lucide-lock"
        :separator="{
            icon: 'i-lucide-user'
        }"
        @submit="onSubmit"
      >
        <template #description>
          Don't have an account? <ULink to="/auth/sign-up" class="text-primary font-medium">Sign up</ULink>.
        </template>
        <template #password-hint>
          <ULink to="#" class="text-primary font-medium" tabindex="-1">Forgot password?</ULink>
        </template>
        <template #validation>
          <UAlert color="error" icon="i-lucide-info" title="Error signing in" />
        </template>
        <template #footer>
          By signing in, you agree to our <ULink to="#" class="text-primary font-medium">Terms of Service</ULink>.
        </template>
      </UAuthForm>
    </div>
</template>
