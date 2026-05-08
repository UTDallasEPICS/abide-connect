<script setup lang="ts">
import { ref } from "vue"

const form = ref({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
})

const loading = ref(false)
const errorMessage = ref("")

async function submitApplication() {
  try {
    loading.value = true

    await $fetch("/api/admin/application", {
      method: "POST",
      body: {
        firstName: form.value.firstName,
        lastName: form.value.lastName,
        email: form.value.email,
        phone: form.value.phone,
      },
    })

    await navigateTo("/auth/thank-you")

  } catch (err) {
    console.error(err)
    errorMessage.value = "Submission failed"
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center p-8 my-8">

    <div class="w-full max-w-2xl pb-32">

      <button
        class="mb-6 text-cyan-400 hover:text-cyan-300"
        @click="navigateTo('/auth/login')"
      >
        ← Back to Login
      </button>

      <h1 class="text-5xl font-bold mb-8">
        Volunteer Application
      </h1>

      <form
        class="flex flex-col gap-6"
        @submit.prevent="submitApplication"
      >

        <!-- FIRST NAME -->
        <div class="section">
          <label>1. First Name</label>

          <input
            v-model="form.firstName"
            type="text"
          />
        </div>

        <!-- LAST NAME -->
        <div class="section">
          <label>2. Last Name</label>

          <input
            v-model="form.lastName"
            type="text"
          />
        </div>

        <!-- EMAIL -->
        <div class="section">
          <label>3. Email</label>

          <input
            v-model="form.email"
            type="email"
          />
        </div>

        <!-- PHONE -->
        <div class="section">
          <label>4. Phone Number</label>

          <input
            v-model="form.phone"
            type="text"
          />
        </div>

        <!-- SUBMIT -->
        <button
          type="submit"
          class="submit-btn"
          :disabled="loading"
        >
          {{ loading ? "Submitting..." : "Submit Application" }}
        </button>

      </form>

      <p
        v-if="errorMessage"
        class="text-red-400 mt-4"
      >
        {{ errorMessage }}
      </p>

    </div>
  </div>
</template>

<style scoped>
.section {
  background: #111c33;
  padding: 30px;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: 1px solid #1d3557;
}

label {
  font-weight: bold;
  font-size: 20px;
}

input {
  padding: 18px;
  border-radius: 12px;
  background: #020d2b;
  color: white;
  border: 1px solid #1d3557;
  font-size: 18px;
}

.submit-btn {
  background: #4ade80;
  padding: 18px;
  border-radius: 12px;
  width: 100%;
  font-weight: bold;
  color: black;
  font-size: 20px;
}
</style>