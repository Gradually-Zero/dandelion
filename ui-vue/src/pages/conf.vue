<script setup lang="ts">
import Button from 'primevue/button'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { ref, onBeforeUnmount, onMounted } from 'vue'

// 使用 ref 以便 Vue 能响应式更新
const selected_file = ref<string>('')
let unlistenSelectedChange: (() => void) | undefined

// 获取文件
onMounted(async () => {
    try {
        unlistenSelectedChange = await listen<string>('selected-change', (event) => {
            selected_file.value = event.payload
        })
        selected_file.value = await invoke<string>('get_selected_file')
    } catch (error) {
        console.error('Error fetching selected file:', error)
    }
})

onBeforeUnmount(() => {
    unlistenSelectedChange?.()
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
    <div class="flex flex-col items-start gap-3">
        <div>选择的文件：{{ selected_file }}</div>
        <Button label="选择文件" @click="selectFile" />
    </div>
</template>
