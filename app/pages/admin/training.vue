<script setup lang="ts">
import { ref } from 'vue'

type Volunteer = {
  id: number
  name: string
  verified: boolean
}

const volunteers = ref<Volunteer[]>([])

const { data } = await useFetch('/api/admin/training')

volunteers.value =
  data.value?.map((v: any) => ({
    id: v.id,
    name: v.name || 'Unknown Volunteer',
    verified: v.status === 'APPROVED'
  })) || []
  const newName = ref('')
const newEmail = ref('')

async function addVolunteer() {

  const newVolunteer = await $fetch('/api/admin/training', {
    method: 'POST',
    body: {
      name: newName.value,
      email: newEmail.value
    }
  })

  volunteers.value.push({
    id: newVolunteer.id,
    name: newVolunteer.name,
    verified: false
  })

  newName.value = ''
  newEmail.value = ''
}

async function toggle(v: Volunteer) {

v.verified = !v.verified

await $fetch('/api/admin/volunteer', {
  method: 'PATCH',
  body: {
    id: v.id,
    verified: v.verified
  }
})
}

function removePerson(id: number) {
  volunteers.value = volunteers.value.filter(v => v.id !== id)
}
</script>

<template>
  <div class="page">
    <h1>Volunteer Verification</h1>

 <div class="add-form">
    <input v-model="newName" placeholder="Volunteer Name" />
    <input v-model="newEmail" placeholder="Email" />
    <button @click="addVolunteer">Add Volunteer</button>
  </div>

    <div 
      class="card" 
      v-for="v in volunteers" 
      :key="v.id"
      :class="{ verified: v.verified }"
    >
      <div class="left">
        <span>{{ v.name }}</span>
        <small v-if="v.verified">Verified</small>
        <small v-else>Pending</small>
      </div>

      <div class="actions">
        <input 
          type="checkbox" 
          :checked="v.verified"
          @change="toggle(v)"
        />

        <button @click="removePerson(v.id)">Delete</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  max-width: 650px;
  margin: 120px auto 40px; /* pushes content down */
  color: white;
}


.card {
  background: #0f1b2d;
  padding: 14px 18px;
  border-radius: 10px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card.verified {
  border-left: 6px solid #4ade80;
}

.left {
  display: flex;
  flex-direction: column;
}

small {
  font-size: 12px;
  opacity: 0.8;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

button {
  background: #ef4444;
  border: none;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}

button:hover {
  opacity: 0.85;
}

input {
  transform: scale(1.4);
}
</style>
