<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { invoke } from '@tauri-apps/api'
async function fetchMarkdownAst(filePath: string) {
  try {
    const jsonAst = await invoke<string>('get_markdown_ast', { filePath })
    console.log('jsonAst', jsonAst)
    console.log('MDAST:', JSON.parse(jsonAst))
  } catch (error) {
    console.error('Error fetching MDAST:', error)
  }
}
fetchMarkdownAst('./a.md')
</script>

<template>
  <header>
    <nav>
      <RouterLink to="/">Home</RouterLink>
      <RouterLink to="/write">Write</RouterLink>
      <RouterLink to="/table">Table</RouterLink>
    </nav>
  </header>

  <RouterView />
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}
</style>
