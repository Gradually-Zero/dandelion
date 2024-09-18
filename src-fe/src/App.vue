<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { listen } from '@tauri-apps/api/event'

// 使用 ref 以便 Vue 能响应式更新
const selected_file = ref<string>('')
const jsonAst = ref<string>('')

// 监听文件变化
listen<string>('selected-change', (event) => {
  selected_file.value = event.payload
})

// 获取文件
onMounted(async () => {
  try {
    selected_file.value = await invoke<string>('get_selected_file')
  } catch (error) {
    console.error('Error fetching selected file:', error)
  }
})

const parseMd = async () => {
  const temp = await invoke<string>('get_markdown_ast')
  jsonAst.value = temp
  console.log('jsonAst', jsonAst)
  console.log('MDAST:', JSON.parse(temp))
}

const selectFile = async () => {
  try {
    const selectedPath = await open({
      filters: [{ name: 'Markdown 文件', extensions: ['md'] }],
      multiple: false
    })

    if (selectedPath) {
      await invoke('set_selected_file', { filePath: selectedPath })
    }
  } catch (error) {
    console.error('选择文件失败:', error)
  }
}
</script>

<template>
  <header>
    <nav>
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/write">Write</RouterLink>
      <RouterLink to="/table">Table</RouterLink>
    </nav>
  </header>
  <RouterView />
  <Suspense>
    <template #default>
      <div>选择的文件：{{ selected_file }}</div>
    </template>
    <template #fallback>
      <div>加载中...</div>
    </template>
  </Suspense>
  <v-btn @click="selectFile"> 选择文件 </v-btn>
  <v-btn @click="parseMd"> 解析 </v-btn>
  <div>{{ jsonAst }}</div>
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}
</style>
