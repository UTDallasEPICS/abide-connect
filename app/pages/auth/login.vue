<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import { loginFormSchema, loginFormFields, providers } from "#shared/types/authFormTypes";
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
    <UAuthForm
        :schema="loginFormSchema"
        :fields="loginFormFields"
        :providers="providers"
        title="Welcome back!"
        icon="i-lucide-lock"
        @submit="onSubmit"
      >
        <template #description>
          Don't have an account? <ULink to="#" class="text-primary font-medium">Sign up</ULink>.
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
