<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import Column from 'primevue/column'
import Message from 'primevue/message'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { getFirstTableData } from '@/utils'
import type { MdastNode } from '@/types/ast'

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

const getColumnStyle = (width: number | string) => {
    return typeof width === 'number' ? { width: `${width}px` } : { minWidth: '220px' }
}

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
    <Card :pt="{
        root: 'h-full overflow-hidden',
        body: 'h-full flex flex-col p-0',
        header: 'px-5 py-4 border-b border-(--p-surface-200)',
        content: 'min-h-0 flex-1 px-5 pb-5 pt-0'
    }">
        <template #header>
            <div class="flex items-center justify-between gap-2">
                <div class="flex w-75 items-center gap-1.5">
                    <InputText v-model="searchQuery" class="min-w-0 flex-1" />
                    <Button v-if="searchQuery" label="清空" severity="secondary" text @click="searchQuery = ''" />
                </div>
                <div v-if="searchQuery && searchQuery.length > 0" class="flex min-w-0 items-center gap-3">
                    <span>{{ totalForCell1.total }}</span>
                    <span>Count of Entries: {{ totalForCell1.count }}</span>
                </div>
                <Button label="解析" @click="parseMd" />
            </div>
        </template>

        <div class="flex h-full flex-col gap-3">
            <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>
            <DataTable :value="filteredData" scrollable scroll-height="flex"
                :virtual-scroller-options="{ itemSize: 44 }" class="min-h-0 flex-1" :pt="{ tableContainer: 'h-full' }">
                <Column v-for="column in columns" :key="column.dataKey" :field="column.dataKey" :header="column.title"
                    :style="getColumnStyle(column.width)" />
            </DataTable>
        </div>
    </Card>
</template>
