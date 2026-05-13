<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import Message from 'primevue/message'
import Toolbar from 'primevue/toolbar'
import DataTable from 'primevue/datatable'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { FilterMatchMode } from '@primevue/core/api';
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { getFirstTableData } from '@/utils'
import ClearableInputText from '@/components/ClearableInputText.vue'
import type { MdastNode } from '@/types/ast'
import type { DataTableFilterEvent } from 'primevue/datatable'

type TableDataRow = Record<string, string | undefined>

type FindTableRow = Record<string, string | number | undefined> & {
    index: number
}

type TextFilter = {
    value: string | null
    matchMode: string
}

type FindTableFilters = {
    global: TextFilter
    index: TextFilter
    'cell-0': TextFilter
    'cell-1': TextFilter
    'cell-2': TextFilter
    'cell-3': TextFilter
}

const filters = ref<FindTableFilters>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    index: { value: null, matchMode: FilterMatchMode.CONTAINS },
    "cell-0": { value: null, matchMode: FilterMatchMode.CONTAINS },
    "cell-1": { value: null, matchMode: FilterMatchMode.CONTAINS },
    "cell-2": { value: null, matchMode: FilterMatchMode.CONTAINS },
    "cell-3": { value: null, matchMode: FilterMatchMode.CONTAINS },
});
const globalFilterFields = ['index', 'cell-0', 'cell-1', 'cell-2', 'cell-3']
const tableData = ref<TableDataRow[]>([])
const filteredRows = ref<FindTableRow[]>([])
const errorMessage = ref<string>('')
let unlistenSelectedChange: (() => void) | undefined

const tableRows = computed<FindTableRow[]>(() => {
    return tableData.value.map((row, index) => ({ index: index + 1, ...row }))
})

const hasGlobalFilter = computed(() => {
    return Boolean(filters.value.global.value?.trim())
})

const totalForCell1 = computed(() => {
    if (!hasGlobalFilter.value) {
        return { total: 0, count: 0 }
    }

    return filteredRows.value.reduce(
        (result, row) => {
            const value = parseFloat(String(row['cell-1'] ?? '0'))
            if (!Number.isNaN(value)) {
                result.total += value
                result.count += 1
            }

            return result
        },
        { total: 0, count: 0 }
    )
})

const clearTableState = () => {
    tableData.value = []
    errorMessage.value = ''
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
        if (error instanceof Error) {
            errorMessage.value = '解析失败: ' + error.message
        } else {
            errorMessage.value = '解析失败: 未知错误'
        }
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

const handleFilter = (event: DataTableFilterEvent) => {
    filteredRows.value = (event.filteredValue ?? tableRows.value) as FindTableRow[]
}

watch(tableRows, (rows) => {
    filteredRows.value = rows
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
    <DataTable v-model:filters="filters" :value="tableRows" :globalFilterFields="globalFilterFields" filterDisplay="row"
        scrollable scroll-height="flex" :virtual-scroller-options="{ itemSize: 44 }" :pt="{ tableContainer: 'h-full' }"
        @filter="handleFilter">
        <template #header>
            <Toolbar class="border-0 bg-transparent p-0">
                <template #start>
                    <ClearableInputText v-model="filters.global.value" class="min-w-0" fluid />
                </template>
                <template #center>
                    <div v-if="hasGlobalFilter" class="flex min-w-0 items-center gap-3">
                        <span>{{ totalForCell1.total }}</span>
                        <span>Count of Entries: {{ totalForCell1.count }}</span>
                    </div>
                </template>
                <template #end>
                    <Button label="解析" @click="parseMd" />
                </template>
            </Toolbar>
        </template>
        <template #empty>
            <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>
            <div class="py-6 text-center text-(--p-text-muted-color)">暂无数据</div>
        </template>
        <template #loading>Loading</template>
        <Column field="index" filterField="index" header="#" :showFilterMenu="false">
            <template #filter="{ filterModel, filterCallback }">
                <ClearableInputText v-model="filterModel.value" type="text" @input="filterCallback()"
                    @clear="filterCallback()" fluid />
            </template>
        </Column>
        <Column field="cell-0" filterField="cell-0" header="Column 1" :showFilterMenu="false">
            <template #filter="{ filterModel, filterCallback }">
                <ClearableInputText v-model="filterModel.value" type="text" @input="filterCallback()"
                    @clear="filterCallback()" fluid />
            </template>
        </Column>
        <Column field="cell-1" filterField="cell-1" header="Column 2" :showFilterMenu="false">
            <template #filter="{ filterModel, filterCallback }">
                <ClearableInputText v-model="filterModel.value" type="text" @input="filterCallback()"
                    @clear="filterCallback()" fluid />
            </template>
        </Column>
        <Column field="cell-2" filterField="cell-2" header="Column 3" :showFilterMenu="false">
            <template #filter="{ filterModel, filterCallback }">
                <ClearableInputText v-model="filterModel.value" type="text" @input="filterCallback()"
                    @clear="filterCallback()" fluid />
            </template>
        </Column>
        <Column field="cell-3" filterField="cell-3" header="Column 4" :showFilterMenu="false">
            <template #filter="{ filterModel, filterCallback }">
                <ClearableInputText v-model="filterModel.value" type="text" @input="filterCallback()"
                    @clear="filterCallback()" fluid />
            </template>
        </Column>
    </DataTable>
</template>
