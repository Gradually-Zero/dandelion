<script setup lang="ts">
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useConfirm } from 'primevue/useconfirm'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { getErrorMessage } from '../utils'
import { uiThemeMode } from '../utils/uiTheme'
import { registerEditorThemes, } from '../monaco/themes'
import type { EditorThemeName } from '../monaco/themes'

declare global {
    interface Window {
        MonacoEnvironment?: {
            getWorker: (_workerId: string, label: string) => Worker
        }
    }
}

window.MonacoEnvironment = {
    getWorker() {
        return new editorWorker()
    }
}

registerEditorThemes(monaco)

const router = useRouter()
const appWindow = getCurrentWindow()
const toast = useToast()
const confirm = useConfirm()

const editorContainer = ref<HTMLDivElement | null>(null)
const currentFilePath = ref('')
const savedContent = ref('')
const draftContent = ref('')
const isLoading = ref(false)
const isSaving = ref(false)
const isFormatting = ref(false)
const loadError = ref('')
const isSwitchDialogVisible = ref(false)
const pendingFilePath = ref<string | null>(null)
const ignoreSelectedChangePath = ref('')
const editorWordWrap = ref<'on' | 'off'>('on')
const hasLoadedEditorPreferences = ref(false)

const editor = shallowRef<monaco.editor.IStandaloneCodeEditor>()
const model = shallowRef<monaco.editor.ITextModel>()
const resizeObserver = shallowRef<ResizeObserver>()
const formatProviderDisposable = shallowRef<monaco.IDisposable>()
let unlistenSelectedChange: (() => void) | undefined
let unlistenCloseRequested: (() => void) | undefined
let systemThemeQuery: MediaQueryList | undefined
let removeSystemThemeListener: (() => void) | undefined
let suppressModelUpdate = false
let isLeaveConfirmOpen = false

const isDirty = computed(() => draftContent.value !== savedContent.value)
const hasSelectedFile = computed(() => currentFilePath.value.length > 0)
const statusText = computed(() => {
    if (loadError.value) {
        return '加载失败'
    }

    return isDirty.value ? '未保存' : '已保存'
})
const statusSeverity = computed(() => (isDirty.value ? 'warn' : 'success'))

const showSuccess = (message: string) => {
    toast.add({ severity: 'success', summary: message, life: 3000 })
}

const showError = (message: string) => {
    toast.add({ severity: 'error', summary: '错误', detail: message, life: 5000 })
}

const requestConfirmation = (options: {
    message: string
    header: string
    acceptLabel: string
    rejectLabel: string
}) => {
    return new Promise<boolean>((resolve) => {
        let settled = false
        const settle = (value: boolean) => {
            if (settled) {
                return
            }

            settled = true
            resolve(value)
        }

        confirm.require({
            message: options.message,
            header: options.header,
            acceptLabel: options.acceptLabel,
            rejectLabel: options.rejectLabel,
            defaultFocus: 'reject',
            rejectProps: { severity: 'secondary', outlined: true },
            acceptProps: { severity: 'warn' },
            accept: () => settle(true),
            reject: () => settle(false),
            onHide: () => settle(false)
        })
    })
}

const normalizeWordWrap = (value: string): 'on' | 'off' => {
    return value === 'off' ? 'off' : 'on'
}

const getNextWordWrap = (): 'on' | 'off' => {
    return editorWordWrap.value === 'on' ? 'off' : 'on'
}

const applyEditorWordWrap = (wordWrap: 'on' | 'off') => {
    editorWordWrap.value = wordWrap
    editor.value?.updateOptions({ wordWrap })
}

const getSystemEditorTheme = (matchesDark: boolean): EditorThemeName => {
    return matchesDark ? 'vscode-dark-plus' : 'vs'
}

const applySystemEditorTheme = () => {
    if (uiThemeMode.value === 'system') {
        const theme = getSystemEditorTheme(systemThemeQuery?.matches ?? false)
        monaco.editor.setTheme(theme)
    }
}

const stopSystemThemeListener = () => {
    removeSystemThemeListener?.()
    removeSystemThemeListener = undefined
    systemThemeQuery = undefined
}

const watchSystemEditorTheme = () => {
    stopSystemThemeListener()

    systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    applySystemEditorTheme()

    const handleSystemThemeChange = () => {
        applySystemEditorTheme()
    }

    if (systemThemeQuery.addEventListener) {
        systemThemeQuery.addEventListener('change', handleSystemThemeChange)
        removeSystemThemeListener = () => {
            systemThemeQuery?.removeEventListener('change', handleSystemThemeChange)
        }
        return
    }

    systemThemeQuery.addListener(handleSystemThemeChange)
    removeSystemThemeListener = () => {
        systemThemeQuery?.removeListener(handleSystemThemeChange)
    }
}

const applyUiThemeToEditorTheme = (mode: 'system' | 'light' | 'dark') => {
    if (mode === 'system') {
        watchSystemEditorTheme()
        return
    }

    stopSystemThemeListener()
    const theme = mode === 'dark' ? 'vscode-dark-plus' : 'vs'
    monaco.editor.setTheme(theme)
}

const persistEditorWordWrap = async (wordWrap: 'on' | 'off') => {
    try {
        await invoke('set_editor_word_wrap', { wordWrap })
    } catch (error) {
        const message = getErrorMessage(error)
        showError(`配置保存失败: ${message}`)
    }
}

const toggleEditorWordWrap = async () => {
    const nextWordWrap = getNextWordWrap()
    applyEditorWordWrap(nextWordWrap)
    await persistEditorWordWrap(nextWordWrap)
}

const syncEditorValue = (value: string) => {
    if (!model.value || model.value.getValue() === value) {
        return
    }

    suppressModelUpdate = true
    model.value.setValue(value)
    suppressModelUpdate = false
}

const applyLoadedContent = (filePath: string, content: string) => {
    currentFilePath.value = filePath
    savedContent.value = content
    draftContent.value = content
    loadError.value = ''
    syncEditorValue(content)
}

const resetEditorState = (filePath = '') => {
    currentFilePath.value = filePath
    savedContent.value = ''
    draftContent.value = ''
    loadError.value = ''
    syncEditorValue('')
}

const readSelectedFile = async (filePath: string) => {
    isLoading.value = true

    try {
        const content = await invoke<string>('read_selected_file_content')
        applyLoadedContent(filePath, content)
    } catch (error) {
        loadError.value = getErrorMessage(error)
        currentFilePath.value = filePath
        savedContent.value = ''
        draftContent.value = ''
        syncEditorValue('')
    } finally {
        isLoading.value = false
        await nextTick()
        editor.value?.layout()
    }
}

const loadCurrentSelection = async () => {
    try {
        const selectedFilePath = await invoke<string>('get_selected_file')

        if (!selectedFilePath) {
            resetEditorState()
            return
        }

        await readSelectedFile(selectedFilePath)
    } catch (error) {
        const message = getErrorMessage(error)
        resetEditorState()
        loadError.value = message
        showError(`文件选择状态加载失败: ${message}`)
    }
}

const loadEditorPreferences = async () => {
    try {
        const wordWrap = await invoke<string>('get_editor_word_wrap')

        applyEditorWordWrap(normalizeWordWrap(wordWrap))
    } catch (error) {
        const message = getErrorMessage(error)
        showError(`编辑器配置加载失败: ${message}`)
        applyEditorWordWrap('on')
    } finally {
        hasLoadedEditorPreferences.value = true
    }
}

const saveContent = async () => {
    if (!currentFilePath.value || !hasSelectedFile.value || !isDirty.value) {
        return true
    }

    isSaving.value = true

    try {
        await invoke('write_selected_file_content', { content: draftContent.value })
        savedContent.value = draftContent.value
        showSuccess('文件已保存')
        return true
    } catch (error) {
        const message = getErrorMessage(error)
        showError(message)
        return false
    } finally {
        isSaving.value = false
    }
}

const formatMarkdown = async (source: string) => {
    const [{ format }, markdownPlugin] = await Promise.all([
        import('prettier-v2/standalone'),
        import('prettier-v2/parser-markdown')
    ])

    return format(source, {
        parser: 'markdown',
        plugins: [markdownPlugin.default ?? markdownPlugin]
    })
}

const confirmLeaveEditor = async () => {
    if (!isDirty.value) {
        return true
    }

    if (isLeaveConfirmOpen) {
        return false
    }

    isLeaveConfirmOpen = true

    try {
        return await requestConfirmation({
            message: '当前内容未保存，继续离开将丢失修改。是否继续离开当前页面？',
            header: '未保存修改',
            acceptLabel: '继续离开',
            rejectLabel: '留在当前页面'
        })
    } finally {
        isLeaveConfirmOpen = false
    }
}

const saveAndSwitch = async () => {
    const nextPath = pendingFilePath.value
    const didSave = await saveContent()
    if (!didSave) {
        return
    }

    isSwitchDialogVisible.value = false
    pendingFilePath.value = null

    if (!nextPath) {
        resetEditorState()
        return
    }

    await readSelectedFile(nextPath)
}

const discardAndSwitch = async () => {
    const nextPath = pendingFilePath.value
    isSwitchDialogVisible.value = false
    pendingFilePath.value = null

    if (!nextPath) {
        resetEditorState()
        return
    }

    await readSelectedFile(nextPath)
}

const cancelSwitch = async () => {
    const previousPath = currentFilePath.value
    isSwitchDialogVisible.value = false
    pendingFilePath.value = null

    if (!previousPath) {
        return
    }

    ignoreSelectedChangePath.value = previousPath
    await invoke('set_selected_file', { filePath: previousPath })
}

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!isDirty.value) {
        return
    }

    event.preventDefault()
    // 为了兼容浏览器，这里保留这个已废弃的接口，
    // 这样在刷新、关闭标签页和直接跳转时，原生离开提示仍然会出现。
    event.returnValue = ''
}

const reloadContent = async () => {
    if (!hasSelectedFile.value) {
        return
    }

    if (isDirty.value) {
        const shouldReload = await requestConfirmation({
            message: '重新加载会丢弃当前未保存修改，是否继续？',
            header: '提示',
            acceptLabel: '继续加载',
            rejectLabel: '取消'
        })

        if (!shouldReload) {
            return
        }
    }

    await readSelectedFile(currentFilePath.value)
}

const initEditor = () => {
    if (!editorContainer.value || editor.value || model.value) {
        return
    }

    applyUiThemeToEditorTheme(uiThemeMode.value)
    model.value = monaco.editor.createModel(draftContent.value, 'markdown')
    editor.value = monaco.editor.create(editorContainer.value, {
        model: model.value,
        automaticLayout: false,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: editorWordWrap.value,
        tabSize: 2,
        fontSize: 14
    })

    editor.value.addAction({
        id: 'editor.action.toggleWordWrap',
        label: 'Toggle Word Wrap',
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
        run: async () => {
            await toggleEditorWordWrap()
        }
    })

    editor.value.addAction({
        id: 'editor.action.saveMarkdown',
        label: 'Save Markdown',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: async () => {
            await saveContent()
        }
    })

    model.value.onDidChangeContent(() => {
        if (suppressModelUpdate || !model.value) {
            return
        }

        draftContent.value = model.value.getValue()
    })

    resizeObserver.value = new ResizeObserver(() => {
        editor.value?.layout()
    })
    resizeObserver.value.observe(editorContainer.value)
    formatProviderDisposable.value?.dispose()
    formatProviderDisposable.value = monaco.languages.registerDocumentFormattingEditProvider(
        'markdown',
        {
            provideDocumentFormattingEdits: async (currentModel) => {
                if (isFormatting.value) {
                    return []
                }

                isFormatting.value = true

                try {
                    const source = currentModel.getValue()
                    const formattedContent = await formatMarkdown(source)

                    if (formattedContent === source) {
                        return []
                    }

                    return [
                        {
                            range: currentModel.getFullModelRange(),
                            text: formattedContent
                        }
                    ]
                } catch (error) {
                    const message = getErrorMessage(error)
                    showError(`格式化失败: ${message}`)
                    return []
                } finally {
                    isFormatting.value = false
                }
            }
        }
    )
}

onMounted(async () => {
    window.addEventListener('beforeunload', handleBeforeUnload)
    applyUiThemeToEditorTheme(uiThemeMode.value)

    unlistenCloseRequested = await appWindow.onCloseRequested(async (event) => {
        if (!isDirty.value) {
            return
        }

        const shouldLeave = await confirmLeaveEditor()
        if (!shouldLeave) {
            event.preventDefault()
        }
    })

    unlistenSelectedChange = await listen<string>('selected-change', async (event) => {
        const nextPath = event.payload

        if (ignoreSelectedChangePath.value && nextPath === ignoreSelectedChangePath.value) {
            ignoreSelectedChangePath.value = ''
            return
        }

        if (nextPath === currentFilePath.value) {
            return
        }

        if (!nextPath) {
            if (isDirty.value && currentFilePath.value) {
                pendingFilePath.value = ''
                isSwitchDialogVisible.value = true
                return
            }

            resetEditorState()
            return
        }

        if (isDirty.value && currentFilePath.value) {
            pendingFilePath.value = nextPath
            isSwitchDialogVisible.value = true
            return
        }

        await readSelectedFile(nextPath)
    })

    await loadEditorPreferences()
    await loadCurrentSelection()
})

watch(
    uiThemeMode,
    (mode) => {
        applyUiThemeToEditorTheme(mode)
    },
    { flush: 'post' }
)

onBeforeRouteLeave(async (to, from) => {
    if (to.path === from.path) {
        return true
    }

    return await confirmLeaveEditor()
})

watch(
    () => editorContainer.value,
    async (container) => {
        if (!container || !hasLoadedEditorPreferences.value) {
            return
        }

        await nextTick()
        initEditor()
        syncEditorValue(draftContent.value)
        editor.value?.layout()
    }
)

watch(
    () => hasLoadedEditorPreferences.value,
    async (loaded) => {
        if (!loaded || !editorContainer.value) {
            return
        }

        await nextTick()
        initEditor()
        syncEditorValue(draftContent.value)
        editor.value?.layout()
    }
)

onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
    stopSystemThemeListener()
    unlistenSelectedChange?.()
    unlistenCloseRequested?.()
    formatProviderDisposable.value?.dispose()
    resizeObserver.value?.disconnect()
    editor.value?.dispose()
    model.value?.dispose()
})
</script>

<template>
    <div
        class="flex h-full flex-col overflow-hidden rounded-md border border-(--p-content-border-color) bg-(--p-content-background)">
        <header class="flex-none border-b border-(--p-content-border-color) px-4 py-3.5">
            <div class="flex items-center justify-between gap-4">
                <div class="flex min-w-0 items-center gap-3">
                    <span class="shrink-0 text-(--p-text-muted-color)">当前文件</span>
                    <span class="truncate">{{ currentFilePath || '未选择文件' }}</span>
                    <Tag :severity="statusSeverity" :value="statusText" />
                </div>
                <Button label="重新加载" severity="secondary" outlined :disabled="!hasSelectedFile || isLoading"
                    @click="reloadContent" />
            </div>
        </header>

        <section class="min-h-0 flex-1 p-4">
            <div v-if="!hasSelectedFile" class="flex h-full flex-col items-center justify-center gap-3.5 text-center">
                <Message severity="info" :closable="false">还没有选择 Markdown 文件</Message>
                <Button label="去配置页选择文件" @click="router.push('/conf')" />
            </div>

            <div v-else-if="loadError" class="flex h-full flex-col items-center justify-center gap-3.5 text-center">
                <Message severity="error" :closable="false">
                    <strong>文件加载失败：</strong>
                    <span>{{ loadError }}</span>
                </Message>
                <div class="flex flex-wrap items-center justify-end gap-2">
                    <Button label="去配置页" severity="secondary" outlined @click="router.push('/conf')" />
                    <Button label="重试" @click="reloadContent" />
                </div>
            </div>

            <div v-else class="relative h-full">
                <div v-if="isLoading" class="space-y-3 p-3">
                    <Skeleton v-for="row in 6" :key="row" height="1.5rem" />
                </div>
                <div ref="editorContainer" class="h-full border border-(--p-content-border-color) transition-opacity"
                    :class="{ 'pointer-events-none opacity-35': isLoading }" />
            </div>
        </section>

        <Dialog v-model:visible="isSwitchDialogVisible" header="检测到未保存修改" modal :style="{ width: '460px' }"
            :closable="false" :close-on-escape="false">
            <span>
                当前内容还没有保存。切换文件前，你可以选择保存并切换，或放弃修改后切换。
                如果选择“留在当前文件并恢复配置”，将不会切换文件，并且会把配置中的当前选中文件恢复为当前正在编辑的文件。
            </span>
            <template #footer>
                <div class="flex flex-wrap items-center justify-end gap-2">
                    <Button label="留在当前文件并恢复配置" severity="secondary" outlined @click="cancelSwitch" />
                    <Button label="放弃并切换" severity="secondary" @click="discardAndSwitch" />
                    <Button label="保存并切换" :loading="isSaving" @click="saveAndSwitch" />
                </div>
            </template>
        </Dialog>
    </div>
</template>
