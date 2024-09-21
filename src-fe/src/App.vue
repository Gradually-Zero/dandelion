<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const items = [
  { name: 'home', icon: 'mdi-application-outline', route: '/' },
  { name: 'find', icon: 'mdi-magnify', route: '/find' },
  { name: 'conf', icon: 'mdi-cog', route: '/conf' }
]

const route = useRoute()
// 初始选中为当前路由的路径
const selectedItem = ref(route.path)

// 监听路由变化，更新选中状态
watch(
  () => route.path,
  (newPath) => {
    selectedItem.value = newPath
  }
)
</script>

<template>
  <v-app>
    <v-bottom-navigation v-model="selectedItem" app>
      <v-btn v-for="item in items" :key="item.name" :to="item.route" icon>
        <v-icon>{{ item.icon }}</v-icon>
      </v-btn>
    </v-bottom-navigation>
    <v-main>
      <v-container>
        <router-view />
      </v-container>
    </v-main>
  </v-app>
</template>
