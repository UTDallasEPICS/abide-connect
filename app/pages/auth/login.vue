<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import type { LoginSchema } from "~~/shared/types/auth/loginTypes";
import { loginFields, loginSchema } from "~~/shared/types/auth/loginTypes";
import { authProviders } from "~~/shared/types/auth/providers";

// const state = reactive<Partial<LoginSchema>>({
//     email: undefined,
//     password: undefined,
// });

const isLoading = ref(false);
const errorMessage = ref<string | null>(null);

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
        
        // Wait for the next tick to ensure cookies are set
        await nextTick();  
        await navigateTo("/volunteer/");
    } catch (error: unknown) {
        console.log(error);
        errorMessage.value = (error as { message: string }).message;
    } finally {
        isLoading.value = false;
    }
}
</script>

<template>
    <div class="flex flex-col items-center justify-center p-8 min-h-screen">
        <UAuthForm
            class="w-full max-w-md"
            :schema="loginSchema"
            :fields="loginFields"
            :providers="authProviders"
            title="Welcome back!"
            icon="i-lucide-lock"
            :separator="{
                icon: 'i-lucide-user',
            }"
            :submit="{ label: 'Sign in', block: true, color: 'neutral' }"
            @submit="onSubmit"
        >
            <template #description>
                Don't have an account?
                <ULink to="/auth/sign-up" class="text-primary font-medium"
                    >Sign up</ULink
                >.
            </template>
            <template #password-hint>
                <ULink to="#" class="text-primary font-medium" tabindex="-1"
                    >Forgot password?</ULink
                >
            </template>
            <template #validation>
                <UAlert
                    v-if="errorMessage"
                    color="error"
                    icon="i-lucide-info"
                    :title="errorMessage"
                />
            </template>
            <template #footer>
                By signing in, you agree to our
                <ULink to="#" class="text-primary font-medium"
                    >Terms of Service</ULink
                >.
            </template>
        </UAuthForm>
    </div>
</template>
