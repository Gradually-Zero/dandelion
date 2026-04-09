<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getFirstTableData } from '@/utilities'
import type { MdastNode } from '@/interface/ast'

const tableData = ref<Record<string, string | undefined>[]>([])
const errorMessage = ref<string>('')
const searchQuery = ref<string>('')
const totalForCell1 = ref({ total: 0, count: 0 })
let unlistenSelectedChange: (() => void) | undefined

const clearTableState = () => {
  tableData.value = []
  errorMessage.value = ''
  totalForCell1.value = { total: 0, count: 0 }
}

const parseMd = async () => {
  try {
    errorMessage.value = ''
    const temp = await invoke<string>('get_markdown_ast')
    const ast: MdastNode = JSON.parse(temp)
    const firstTableData = getFirstTableData(ast)
    tableData.value = firstTableData
  } catch (error) {
    tableData.value = []
    totalForCell1.value = { total: 0, count: 0 }
    if (error instanceof Error) {
      errorMessage.value = '解析失败: ' + error.message
    } else {
      errorMessage.value = '解析失败: 未知错误'
    }
    console.log('parseMd error:', error)
  }
}

const refreshFromSelection = async (selectedFilePath?: string) => {
  if (selectedFilePath !== undefined && !selectedFilePath) {
    clearTableState()
    return
  }

  try {
    const currentSelectedFile = selectedFilePath ?? (await invoke<string>('get_selected_file'))
    if (!currentSelectedFile) {
      clearTableState()
      return
    }
  } catch (error) {
    clearTableState()
    if (error instanceof Error) {
      errorMessage.value = '解析失败: ' + error.message
    } else {
      errorMessage.value = '解析失败: 未知错误'
    }
    return
  }

  await parseMd()
}

const columns = [
  { title: '#', dataKey: 'index', width: 50 },
  { title: 'Column 1', dataKey: 'cell-0', width: 150 },
  { title: 'Column 2', dataKey: 'cell-1', width: 150 },
  { title: 'Column 3', dataKey: 'cell-2', width: 150 },
  { title: 'Column 4', dataKey: 'cell-3', width: '100%' }
]

const filteredData = computed<any[]>(() => {
  if (!searchQuery.value) {
    return tableData.value.map((row, index) => ({ index: index + 1, ...row }))
  }
  return tableData.value
    .filter((row) =>
      Object.values(row).some(
        (val) => val && val.toLowerCase().includes(searchQuery.value.toLowerCase())
      )
    )
    .map((row, index) => ({ index: index + 1, ...row })) // 添加索引
})

watch(searchQuery, (newQuery) => {
  if (newQuery && newQuery.trim().length > 0) {
    let total = 0
    let count = 0
    filteredData.value.forEach((row) => {
      const value = parseFloat(row['cell-1'] || '0')
      if (!isNaN(value)) {
        // 确保是有效的数字
        total += value
        count++
      }
    })
    totalForCell1.value = { total, count }
  } else {
    totalForCell1.value = { total: 0, count: 0 }
  }
})

onMounted(async () => {
  unlistenSelectedChange = await listen<string>('selected-change', async (event) => {
    await refreshFromSelection(event.payload)
  })
  await refreshFromSelection()
})

onBeforeUnmount(() => {
  unlistenSelectedChange?.()
})
</script>

<template>
  <el-card
    style="height: 100%"
    shadow="never"
    :body-style="{ height: 'calc(100% - 80px)', padding: '0 20px 0 20px' }"
  >
    <template #header>
      <div style="display: flex; justify-content: space-between; column-gap: 8px">
        <el-input v-model="searchQuery" clearable style="width: 300px" />
        <div v-if="searchQuery && searchQuery.length > 0" style="justify-self: start">
          <el-space>
            <span>{{ totalForCell1.total }}</span>
            <span>Count of Entries: {{ totalForCell1.count }}</span>
          </el-space>
        </div>
        <el-button @click="parseMd" type="primary">解析</el-button>
      </div>
    </template>
    <div v-if="errorMessage">{{ errorMessage }}</div>
    <div style="height: 100%; width: 100%">
      <el-auto-resizer>
        <template #default="{ height, width }">
          <el-table-v2 :columns="columns" :data="filteredData" :height="height" :width="width" />
        </template>
      </el-auto-resizer>
    </div>
  </el-card>
</template>
