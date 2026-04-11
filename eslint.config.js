import { fileURLToPath } from 'node:url';

import pluginVue from 'eslint-plugin-vue';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import { configureVueProject, defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';

const srcFeRoot = fileURLToPath(new URL('./src-fe', import.meta.url));

configureVueProject({
  rootDir: srcFeRoot,
});

export default defineConfigWithVueTs(
  {
    name: 'dandelion/ignores',
    ignores: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.vscode/**',
      '**/dist/**',
      '**/dist-ssr/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/cypress/videos/**',
      '**/cypress/screenshots/**',
      '**/*.local',
      '**/*.tsbuildinfo',
      '**/auto-imports.d.ts',
      '**/components.d.ts',
    ],
  },
  {
    name: 'dandelion/src-fe',
    files: ['src-fe/**/*.{vue,js,jsx,cjs,mjs,ts,tsx,cts,mts}'],
    extends: [pluginVue.configs['flat/essential'], vueTsConfigs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'vue/multi-word-component-names': 'off',
    },
  },
  skipFormatting
);
