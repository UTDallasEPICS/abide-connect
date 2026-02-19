<script setup lang="ts">
import { ref } from 'vue'

const volunteers = ref([
  { id: 1, name: 'Bob Johnson', verified: false },
  { id: 2, name: 'Maria Lopez', verified: true },
  { id: 3, name: 'Sarah Kim', verified: false },
  { id: 4, name: 'David Chen', verified: true }
])

function toggle(v: any) {
  v.verified = !v.verified
}

function removePerson(id: number) {
  volunteers.value = volunteers.value.filter(v => v.id !== id)
}
</script>

<template>
  <div class="page">
    <h1>Volunteer Verification</h1>

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
