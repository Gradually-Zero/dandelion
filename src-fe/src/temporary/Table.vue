<template>
  <v-data-table :headers="headers" :items="items" item-key="name" items-per-page="5"></v-data-table>
</template>

<script setup lang="ts">
const items = [
  {
    name: 'African Elephant',
    species: 'Loxodonta africana',
    diet: 'Herbivore',
    habitat: 'Savanna, Forests'
  }
]
</script>
