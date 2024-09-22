<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { listen } from '@tauri-apps/api/event'

// 使用 ref 以便 Vue 能响应式更新
const selected_file = ref<string>('')

// 监听配置变化
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
  <el-space direction="vertical" alignment="start">
    <div>选择的文件：{{ selected_file }}</div>
    <el-button @click="selectFile" type="primary">选择文件</el-button>
  </el-space>
</template>
