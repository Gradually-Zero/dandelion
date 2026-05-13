<script setup lang="ts">
import Button from 'primevue/button'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import SelectButton from 'primevue/selectbutton'
import { Moon, Sun, SunMoon } from '@lucide/vue'
import { ref, onBeforeUnmount, onMounted, watch } from 'vue'
import { applyUiTheme, persistUiTheme, uiThemeMode } from '../utils/uiTheme'

const options = ref([
    { icon: SunMoon, value: 'system' },
    { icon: Sun, value: 'light' },
    { icon: Moon, value: 'dark' },
]);

watch(
    uiThemeMode,
    async (mode) => {
        applyUiTheme(mode)
        await persistUiTheme(mode)
    },
    { flush: 'post' }
)

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
    <div class="flex flex-col items-start gap-3 overflow-auto">
        <div class="flex items-center gap-2">
            <div class="shrink-0 w-50">选择的文件</div>
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <div>{{ selected_file }}</div>
                <Button label="选择文件" @click="selectFile" class="shrink-0" />
            </div>
        </div>
        <div class="flex items-center gap-2">
            <div class="shrink-0 w-50">主题</div>
            <div>
                <SelectButton v-model="uiThemeMode" :allowEmpty="false" :options="options" optionLabel="value"
                    optionValue="value">
                    <template #option="slotProps">
                        <component :is="slotProps.option.icon" :size="14" />
                    </template>
                </SelectButton>
            </div>
        </div>
    </div>
</template>
