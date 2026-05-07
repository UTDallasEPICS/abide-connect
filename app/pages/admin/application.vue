<script setup lang="ts">
type Application = {
  id: string
  firstName: string
  email: string
  languages?: string
}

const { data, pending, error } = await useFetch<Application[]>('/api/admin/application')
</script>

<template>
  <div class="p-6 text-white">

    <h1 class="text-2xl mb-6">Volunteer Applications</h1>

    <div v-if="pending">Loading...</div>
    <div v-else-if="error">Error loading data</div>

    <table v-else-if="data && data.length" class="w-full">
      <tr v-for="app in data" :key="app.id">
        <td>{{ app.firstName }}</td>
        <td>{{ app.email }}</td>
        <td>{{ app.languages }}</td>
      </tr>
    </table>

    <div v-else>No applications yet</div>

  </div>
</template>