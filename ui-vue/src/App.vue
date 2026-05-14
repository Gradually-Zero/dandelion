<script setup lang="ts">
import Menu from 'primevue/menu'
import Toast from 'primevue/toast'
import { useRoute, useRouter } from 'vue-router'
import ConfirmDialog from 'primevue/confirmdialog'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { computed, onBeforeUnmount, onMounted, ref, watch, } from 'vue'
import { FileCode, House, Minus, Search, Settings, Square, X } from '@lucide/vue'
import WindowRestoreIcon from '@/components/WindowRestoreIcon.vue'
import type { Component } from 'vue'
import type { MenuItem } from 'primevue/menuitem'

interface NavigationMenuItem extends MenuItem {
    path: string
    iconComponent: Component
}

const route = useRoute()
const router = useRouter()
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
const navigateTo = async (path: string) => {
    if (route.path === path) {
        return
    }

    await router.push(path)
}

const menuItems: NavigationMenuItem[] = [
    { path: '/', label: 'Home', iconComponent: House, command: () => { void navigateTo('/') } },
    { path: '/find', label: 'Find', iconComponent: Search, command: () => { void navigateTo('/find') } },
    { path: '/editor', label: 'Editor', iconComponent: FileCode, command: () => { void navigateTo('/editor') } },
    { path: '/conf', label: 'Configuration', iconComponent: Settings, command: () => { void navigateTo('/conf') } }
]

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
    <div class="flex h-screen flex-col overflow-hidden bg-(--p-content-background) text-(--p-text-color)">
        <header
            class="grid h-11 select-none grid-cols-[200px_minmax(0,1fr)_auto] items-center border-b border-(--p-content-border-color) bg-(--p-content-background)">
            <div class="flex h-full min-w-0 items-center border-r border-(--p-content-border-color) px-3.5"
                data-tauri-drag-region @dblclick="handleTitlebarDoubleClick">
                <span class="truncate text-[14px] font-semibold uppercase tracking-[0.08em]">dandelion</span>
            </div>
            <div class="flex h-full min-w-0 items-center px-3.5" data-tauri-drag-region
                @dblclick="handleTitlebarDoubleClick">
                <span class="truncate text-[14px] text-(--p-text-muted-color)">{{ currentPageTitle }}</span>
            </div>
            <div class="flex h-full items-stretch">
                <button
                    class="inline-flex w-12 cursor-pointer items-center justify-center border-0 bg-transparent text-(--p-text-color) transition-colors hover:bg-(--p-content-hover-background)"
                    type="button" aria-label="最小化" @click="minimizeWindow">
                    <Minus class="block h-4.5 w-4.5" :size="18" />
                </button>
                <button
                    class="inline-flex w-12 cursor-pointer items-center justify-center border-0 bg-transparent text-(--p-text-color) transition-colors hover:bg-(--p-content-hover-background)"
                    type="button" :aria-label="isMaximized ? '还原窗口' : '最大化窗口'" @click="toggleWindowMaximize">
                    <WindowRestoreIcon v-if="isMaximized" class="block" :size="16" />
                    <Square v-else class="block" :size="16" />
                </button>
                <button
                    class="inline-flex w-12 cursor-pointer items-center justify-center border-0 bg-transparent text-(--p-text-color) transition-colors hover:bg-(--p-red-500) hover:text-white"
                    type="button" aria-label="关闭窗口" @click="closeWindow">
                    <X class="block h-4.5 w-4.5" :size="18" />
                </button>
            </div>
        </header>

        <div class="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)]">
            <aside class="min-w-0 border-r border-(--p-content-border-color) bg-(--p-content-background)">
                <nav class="flex min-w-0 flex-col gap-0.5 overflow-hidden p-2" aria-label="主导航">
                    <Menu :model="menuItems"
                        class="box-border w-full min-w-0 max-w-full overflow-hidden border-0 bg-transparent p-0"
                        :style="{ width: '100%', minWidth: 0 }" :pt="{
                            list: 'm-0 flex w-full min-w-0 list-none flex-col gap-0.5 p-0',
                            item: 'm-0 w-full min-w-0',
                            itemContent: 'w-full min-w-0 rounded-md',
                            itemLink: 'box-border w-full min-w-0'
                        }">
                        <template #item="{ item, props }">
                            <a v-bind="props.action"
                                class="box-border flex min-h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2.5 text-left text-(--p-text-color) no-underline transition-colors hover:bg-(--p-content-hover-background)"
                                :class="current === item.path
                                    ? 'bg-(--p-highlight-background) text-(--p-highlight-color)'
                                    : ''">
                                <component :is="item.iconComponent"
                                    class="inline-flex h-[1em] w-[1em] shrink-0 items-center justify-center" />
                                <span class="min-w-0 truncate">{{ item.label }}</span>
                            </a>
                        </template>
                    </Menu>
                </nav>
            </aside>
            <main class="min-h-0 min-w-0 p-4"><router-view /></main>
        </div>
        <Toast position="top-center" />
        <ConfirmDialog />
    </div>
</template>
