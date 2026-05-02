<script setup lang="ts">
import Toast from 'primevue/toast'
import { useRoute, useRouter } from 'vue-router'
import ConfirmDialog from 'primevue/confirmdialog'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { FileCode, House, Minus, Search, Settings, Square, X } from '@lucide/vue'
import WindowRestoreIcon from '@/components/WindowRestoreIcon.vue'

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
const menuItems = [
    { path: '/', label: 'Home', icon: House },
    { path: '/find', label: 'Find', icon: Search },
    { path: '/editor', label: 'Editor', icon: FileCode },
    { path: '/conf', label: 'Configuration', icon: Settings }
]

const navigateTo = async (path: string) => {
    if (route.path === path) {
        return
    }

    await router.push(path)
}

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
    <div class="flex h-screen flex-col overflow-hidden bg-(--p-surface-50) text-(--p-text-color)">
        <header
            class="grid h-11 select-none grid-cols-[200px_minmax(0,1fr)_auto] items-center border-b border-(--p-surface-200) bg-[color-mix(in_srgb,var(--p-surface-0)_94%,var(--p-primary-color)_6%)]">
            <div class="flex h-full min-w-0 items-center border-r border-(--p-surface-200) px-3.5"
                data-tauri-drag-region @dblclick="handleTitlebarDoubleClick">
                <span class="truncate text-[13px] font-semibold uppercase tracking-[0.08em]">dandelion</span>
            </div>
            <div class="flex h-full min-w-0 items-center px-3.5" data-tauri-drag-region
                @dblclick="handleTitlebarDoubleClick">
                <span class="truncate text-[13px] text-(--p-text-muted-color)">{{ currentPageTitle }}</span>
            </div>
            <div class="flex h-full items-stretch">
                <button
                    class="inline-flex w-12 cursor-pointer items-center justify-center border-0 bg-transparent text-(--p-text-color) transition-colors hover:bg-[color-mix(in_srgb,var(--p-surface-100)_86%,var(--p-primary-color)_14%)]"
                    type="button" aria-label="最小化" @click="minimizeWindow">
                    <Minus class="block h-4.5 w-4.5" :size="18" />
                </button>
                <button
                    class="inline-flex w-12 cursor-pointer items-center justify-center border-0 bg-transparent text-(--p-text-color) transition-colors hover:bg-[color-mix(in_srgb,var(--p-surface-100)_86%,var(--p-primary-color)_14%)]"
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
            <aside class="min-w-0 border-r border-(--p-surface-200) bg-(--p-surface-0)">
                <nav class="flex flex-col gap-0.5 p-2" aria-label="主导航">
                    <button v-for="item in menuItems" :key="item.path"
                        class="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2.5 text-left text-(--p-text-color) transition-colors hover:bg-(--p-surface-100)"
                        :class="current === item.path
                            ? 'bg-[color-mix(in_srgb,var(--p-primary-color)_12%,var(--p-surface-0))] text-(--p-primary-color)'
                            : ''" type="button" @click="navigateTo(item.path)">
                        <component :is="item.icon"
                            class="inline-flex h-[1em] w-[1em] shrink-0 items-center justify-center" />
                        <span>{{ item.label }}</span>
                    </button>
                </nav>
            </aside>
            <main class="min-h-0 min-w-0 overflow-hidden p-4"><router-view /></main>
        </div>
        <Toast />
        <ConfirmDialog />
    </div>
</template>
