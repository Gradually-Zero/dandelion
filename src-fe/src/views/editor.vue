<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import * as prettier from 'prettier-v2/standalone'
import { ElMessage, ElMessageBox } from 'element-plus'
import markdownPlugin from 'prettier-v2/parser-markdown'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  DEFAULT_EDITOR_THEME,
  normalizeEditorTheme,
  registerEditorThemes,
  type EditorThemeName
} from '../monaco/themes'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'

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
const editorTheme = ref<EditorThemeName>(DEFAULT_EDITOR_THEME)
const hasLoadedEditorPreferences = ref(false)

const editor = shallowRef<monaco.editor.IStandaloneCodeEditor>()
const model = shallowRef<monaco.editor.ITextModel>()
const resizeObserver = shallowRef<ResizeObserver>()
const formatProviderDisposable = shallowRef<monaco.IDisposable>()
let unlistenSelectedChange: (() => void) | undefined
let unlistenCloseRequested: (() => void) | undefined
let suppressModelUpdate = false
let isLeaveConfirmOpen = false
let isConfirmingWindowClose = false

const isDirty = computed(() => draftContent.value !== savedContent.value)
const hasSelectedFile = computed(() => currentFilePath.value.length > 0)
const statusText = computed(() => {
  if (loadError.value) {
    return '加载失败'
  }

  return isDirty.value ? '未保存' : '已保存'
})

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

const applyEditorTheme = (theme: EditorThemeName) => {
  editorTheme.value = theme
  monaco.editor.setTheme(theme)
}

const persistEditorWordWrap = async (wordWrap: 'on' | 'off') => {
  try {
    await invoke('set_editor_word_wrap', { wordWrap })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`配置保存失败: ${message}`)
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
    loadError.value = error instanceof Error ? error.message : String(error)
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
    const message = error instanceof Error ? error.message : String(error)
    resetEditorState()
    loadError.value = message
    ElMessage.error(`文件选择状态加载失败: ${message}`)
  }
}

const loadEditorPreferences = async () => {
  try {
    const [wordWrap, theme] = await Promise.all([
      invoke<string>('get_editor_word_wrap'),
      invoke<string>('get_editor_theme')
    ])

    applyEditorTheme(normalizeEditorTheme(theme))
    applyEditorWordWrap(normalizeWordWrap(wordWrap))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`编辑器配置加载失败: ${message}`)
    applyEditorTheme(DEFAULT_EDITOR_THEME)
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
    ElMessage.success('文件已保存')
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(message)
    return false
  } finally {
    isSaving.value = false
  }
}

const formatMarkdown = async (source: string) => {
  return prettier.format(source, {
    parser: 'markdown',
    plugins: [markdownPlugin]
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
    await ElMessageBox.confirm(
      '当前内容未保存，继续离开将丢失修改。是否继续离开当前页面？',
      '未保存修改',
      {
        confirmButtonText: '继续离开',
        cancelButtonText: '留在当前页面',
        type: 'warning'
      }
    )
    return true
  } catch {
    return false
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
  // Keep this deprecated API for browser compatibility so the native leave prompt
  // still appears on refresh, tab close, and direct navigation.
  event.returnValue = ''
}

const reloadContent = async () => {
  if (!hasSelectedFile.value) {
    return
  }

  if (isDirty.value) {
    try {
      await ElMessageBox.confirm('重新加载会丢弃当前未保存修改，是否继续？', '提示', {
        confirmButtonText: '继续加载',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
  }

  await readSelectedFile(currentFilePath.value)
}

const initEditor = () => {
  if (!editorContainer.value || editor.value || model.value) {
    return
  }

  monaco.editor.setTheme(editorTheme.value)
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
          const message = error instanceof Error ? error.message : String(error)
          ElMessage.error(`格式化失败: ${message}`)
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

  unlistenCloseRequested = await appWindow.onCloseRequested(async (event) => {
    if (!isDirty.value || isConfirmingWindowClose) {
      return
    }

    event.preventDefault()
    const shouldLeave = await confirmLeaveEditor()
    if (!shouldLeave) {
      return
    }

    isConfirmingWindowClose = true

    try {
      await appWindow.close()
    } finally {
      isConfirmingWindowClose = false
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
  unlistenSelectedChange?.()
  unlistenCloseRequested?.()
  formatProviderDisposable.value?.dispose()
  resizeObserver.value?.disconnect()
  editor.value?.dispose()
  model.value?.dispose()
})
</script>

<template>
  <el-card
    shadow="never"
    style="height: 100%"
    :body-style="{ height: 'calc(100% - 57px)', padding: '16px' }"
  >
    <template #header>
      <div class="editor-toolbar">
        <div class="editor-toolbar__meta">
          <span class="editor-toolbar__label">当前文件</span>
          <span class="editor-toolbar__path">{{ currentFilePath || '未选择文件' }}</span>
          <el-tag :type="isDirty ? 'warning' : 'success'">{{ statusText }}</el-tag>
        </div>
        <el-space>
          <el-button :disabled="!hasSelectedFile || isLoading" @click="reloadContent"
            >重新加载</el-button
          >
        </el-space>
      </div>
    </template>

    <div v-if="!hasSelectedFile" class="editor-empty">
      <el-empty description="还没有选择 Markdown 文件">
        <el-button type="primary" @click="router.push('/conf')">去配置页选择文件</el-button>
      </el-empty>
    </div>

    <div v-else-if="loadError" class="editor-empty">
      <el-result icon="error" title="文件加载失败" :sub-title="loadError">
        <template #extra>
          <el-space>
            <el-button @click="router.push('/conf')">去配置页</el-button>
            <el-button type="primary" @click="reloadContent">重试</el-button>
          </el-space>
        </template>
      </el-result>
    </div>

    <div v-else class="editor-panel">
      <div v-if="isLoading" class="editor-loading">
        <el-skeleton animated :rows="6" />
      </div>
      <div
        ref="editorContainer"
        class="editor-monaco"
        :class="{ 'editor-monaco--hidden': isLoading }"
      />
    </div>

    <el-dialog
      v-model="isSwitchDialogVisible"
      title="检测到未保存修改"
      width="460px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <span>
        当前内容还没有保存。切换文件前，你可以选择保存并切换，或放弃修改后切换。
        如果选择“留在当前文件并恢复配置”，将不会切换文件，并且会把配置中的当前选中文件恢复为当前正在编辑的文件。
      </span>
      <template #footer>
        <el-space>
          <el-button @click="cancelSwitch">留在当前文件并恢复配置</el-button>
          <el-button @click="discardAndSwitch">放弃并切换</el-button>
          <el-button type="primary" :loading="isSaving" @click="saveAndSwitch"
            >保存并切换</el-button
          >
        </el-space>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.editor-toolbar__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.editor-toolbar__label {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.editor-toolbar__path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-empty,
.editor-panel {
  height: 100%;
}

.editor-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.editor-panel {
  position: relative;
}

.editor-loading {
  padding: 12px;
}

.editor-monaco {
  height: 100%;
  border: 1px solid var(--el-border-color);
  transition: opacity 0.2s ease;
}

.editor-monaco--hidden {
  opacity: 0.35;
  pointer-events: none;
}
</style>
