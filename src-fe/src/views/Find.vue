<script setup lang="ts">
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const jsonAst = ref<string>('')
const parseMd = async () => {
  try {
    const temp = await invoke<string>('get_markdown_ast')
    jsonAst.value = temp
    console.log('jsonAst', jsonAst)
    console.log('MDAST:', JSON.parse(temp))
  } catch (error) {
    console.log('parseMd', error)
  }
}
</script>

<template>
  <v-btn @click="parseMd"> 解析 </v-btn>
  <div>{{ jsonAst }}</div>
</template>
