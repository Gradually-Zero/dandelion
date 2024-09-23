<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { House, Search, Setting } from '@element-plus/icons-vue'

const route = useRoute()
// 初始选中为当前路由的路径
const current = ref<string>(route.path)

// 监听路由变化，更新选中状态
watch(
  () => route.path,
  (newPath) => {
    current.value = newPath
  }
)
</script>

<template>
  <el-container style="height: 100vh">
    <el-aside width="200px" style="border-right: 1px solid var(--el-menu-border-color);">
      <el-menu :default-active="current" :router="true" style="border-right: 0;">
        <el-menu-item index="/">
          <el-icon><House /></el-icon>
          <span>Home</span>
        </el-menu-item>
        <el-menu-item index="/find">
          <el-icon><Search /></el-icon>
          <span>Find</span>
        </el-menu-item>
        <el-menu-item index="/conf">
          <el-icon><Setting /></el-icon>
          <span>Configuration</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-main><router-view /></el-main>
  </el-container>
</template>
