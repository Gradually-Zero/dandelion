<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getFirstTableData } from '@/utilities'

const tableData = ref<Record<string, string | undefined>[]>([])
const errorMessage = ref<string>('')
const searchQuery = ref<string>('')

const parseMd = async () => {
  try {
    errorMessage.value = ''
    const temp = await invoke<string>('get_markdown_ast')
    const ast: MdastNode = JSON.parse(temp)
    const firstTableData = getFirstTableData(ast)
    tableData.value = firstTableData
  } catch (error) {
    if (error instanceof Error) {
      errorMessage.value = '解析失败: ' + error.message
    } else {
      errorMessage.value = '解析失败: 未知错误'
    }
    console.log('parseMd error:', error)
  }
}

const columns = [
  { title: '1', dataKey: 'cell-0', width: 150 },
  { title: '2', dataKey: 'cell-1', width: 150 },
  { title: '3', dataKey: 'cell-2', width: 150 },
  { title: '4', dataKey: 'cell-3' }
]

onMounted(() => {
  parseMd()
})
</script>

<template>
  <el-space style="margin-bottom: 8px">
    <el-input />
    <el-button @click="parseMd" type="primary">解析</el-button>
  </el-space>
  <div style="height: 80vh; width: 80vw">
    <el-auto-resizer>
      <template #default="{ height, width }">
        <el-table-v2 :columns="columns" :data="tableData" :width="width" :height="height" />
      </template>
    </el-auto-resizer>
  </div>
  <div v-if="errorMessage">{{ errorMessage }}</div>
</template>
