<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  CloseBold,
  CopyDocument,
  EditPen,
  Files,
  House,
  Minus,
  Search,
  Setting
} from '@element-plus/icons-vue'

const route = useRoute()
const appWindow = getCurrentWindow()
// 初始选中为当前路由的路径
const current = ref<string>(route.path)
const isMaximized = ref(false)

const routeTitleMap: Record<string, string> = {
  '/': 'Home',
  '/find': 'Find',
  '/editor': 'Editor',
  '/conf': 'Configuration'
}

const currentPageTitle = computed(() => routeTitleMap[route.path] ?? 'dandelion')

const syncMaximizedState = async () => {
  isMaximized.value = await appWindow.isMaximized()
}

const minimizeWindow = async () => {
  await appWindow.minimize()
}

const toggleWindowMaximize = async () => {
  await appWindow.toggleMaximize()
  await syncMaximizedState()
}

const closeWindow = async () => {
  await appWindow.close()
}

const handleTitlebarDoubleClick = async () => {
  await toggleWindowMaximize()
}

// 监听路由变化，更新选中状态
watch(
  () => route.path,
  (newPath) => {
    current.value = newPath
  }
)

let unlistenResize: (() => void) | undefined

onMounted(async () => {
  await syncMaximizedState()
  unlistenResize = await appWindow.onResized(async () => {
    await syncMaximizedState()
  })
})

onBeforeUnmount(() => {
  unlistenResize?.()
})
</script>

<template>
  <div class="app-shell">
    <header class="app-titlebar">
      <div class="app-titlebar__brand" data-tauri-drag-region @dblclick="handleTitlebarDoubleClick">
        <span class="app-titlebar__app-name">dandelion</span>
      </div>
      <div class="app-titlebar__page" data-tauri-drag-region @dblclick="handleTitlebarDoubleClick">
        <span class="app-titlebar__page-name">{{ currentPageTitle }}</span>
      </div>
      <div class="app-titlebar__controls">
        <button
          class="app-titlebar__button"
          type="button"
          aria-label="最小化"
          @click="minimizeWindow"
        >
          <el-icon><Minus /></el-icon>
        </button>
        <button
          class="app-titlebar__button"
          type="button"
          :aria-label="isMaximized ? '还原窗口' : '最大化窗口'"
          @click="toggleWindowMaximize"
        >
          <el-icon>
            <CopyDocument v-if="isMaximized" />
            <Files v-else />
          </el-icon>
        </button>
        <button
          class="app-titlebar__button app-titlebar__button--danger"
          type="button"
          aria-label="关闭窗口"
          @click="closeWindow"
        >
          <el-icon><CloseBold /></el-icon>
        </button>
      </div>
    </header>

    <el-container class="app-layout">
      <el-aside class="app-layout__aside" width="200px">
        <el-menu :default-active="current" :router="true" style="border-right: 0">
          <el-menu-item index="/">
            <el-icon><House /></el-icon>
            <span>Home</span>
          </el-menu-item>
          <el-menu-item index="/find">
            <el-icon><Search /></el-icon>
            <span>Find</span>
          </el-menu-item>
          <el-menu-item index="/editor">
            <el-icon><EditPen /></el-icon>
            <span>Editor</span>
          </el-menu-item>
          <el-menu-item index="/conf">
            <el-icon><Setting /></el-icon>
            <span>Configuration</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main class="app-layout__main"><router-view /></el-main>
    </el-container>
  </div>
</template>

<style scoped>
.app-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color-page);
}

.app-titlebar {
  height: 44px;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) auto;
  align-items: center;
  border-bottom: 1px solid var(--el-border-color);
  background: color-mix(in srgb, var(--el-bg-color) 94%, var(--el-color-primary) 6%);
  user-select: none;
}

.app-titlebar__brand,
.app-titlebar__page {
  height: 100%;
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0 14px;
}

.app-titlebar__brand {
  border-right: 1px solid var(--el-border-color);
}

.app-titlebar__app-name,
.app-titlebar__page-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-titlebar__app-name {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.app-titlebar__page-name {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.app-titlebar__controls {
  height: 100%;
  display: flex;
  align-items: stretch;
}

.app-titlebar__button {
  width: 48px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-regular);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.app-titlebar__button:hover {
  background: color-mix(in srgb, var(--el-fill-color-light) 86%, var(--el-color-primary) 14%);
}

.app-titlebar__button--danger:hover {
  background: var(--el-color-danger);
  color: white;
}

.app-layout {
  min-height: 0;
  flex: 1;
}

.app-layout__aside {
  border-right: 1px solid var(--el-menu-border-color);
}

.app-layout__main {
  min-height: 0;
}
</style>
