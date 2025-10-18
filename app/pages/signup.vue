<script setup>
import { FormSubmitEvent } from "@nuxt/ui";
import { signUpFormSchema } from "#shared/types/signUpFormTypes";
import { SignUpFormSchema } from "#shared/types/signUpFormTypes";

const state = reactive<Partial<SignUpFormSchema>>({
    name: undefined,
    email: undefined,
    password: undefined,
    language: []
})

const isLoading = ref(false)

async function onSubmit(event: FormSubmitEvent<SignUpFormSchema>) {
    isLoading.value = true
    try{
        useFetch("/api/auth/login", {
            method: 'POST',
            body: {
                name:state.name,
                email:state.email,
                password:state.password,
                phone:state.password,
                language:state.language
            }
        })
    } finally {
        isLoading.value = false
    }
}
</script>

<template>
<div class="flex bg-[] h-screen"></div>
</template>