<script setup lang="ts">
const { data, pending, error, refresh } = await useFetch("/api/admin/application")

async function deleteApplication(id: string) {
  try {
    await $fetch(`/api/admin/application?id=${id}`, {
      method: "DELETE",
    })

    await refresh()

  } catch (err) {
    console.error(err)
  }
}
</script>
<template>
  <div class="p-10 text-white">

    <h1 class="text-4xl font-bold mb-8">
      Volunteer Applications
    </h1>

    <!-- LOADING -->
    <div v-if="pending">
      Loading applications...
    </div>

    <!-- ERROR -->
    <div v-else-if="error">
      Error loading applications
    </div>

    <!-- DATA -->
    <table
      v-else-if="data && data.length"
      class="w-full border-collapse"
    >
      <thead>
        <tr class="bg-[#111c33]">
          <th class="p-4 text-left">First Name</th>
          <th class="p-4 text-left">Last Name</th>
          <th class="p-4 text-left">Email</th>
          <th class="p-4 text-left">Phone</th>
          <th class="p-4 text-left">Actions</th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="app in data"
          :key="app.id"
          class="border-b border-gray-700"
        >
          <td class="p-4">
            {{ app.firstName }}
          </td>

          <td class="p-4">
            {{ app.lastName }}
          </td>

          <td class="p-4">
            {{ app.email }}
          </td>

          <td class="p-4">
            {{ app.phone || "N/A" }}
          </td>

          <td class="p-4">
            <button
              class="bg-red-500 px-4 py-2 rounded"
              @click="deleteApplication(app.id)"
            >
              Delete
            </button>
          </td>

        </tr>
      </tbody>
    </table>

    <!-- EMPTY -->
    <div v-else>
      No applications yet
    </div>

  </div>
</template>