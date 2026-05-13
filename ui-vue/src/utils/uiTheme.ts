import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

const THEME_CLASS = 'ddl-dark';

const systemThemeQuery = ref<MediaQueryList | null>(null);
let removeSystemThemeListener: (() => void) | null = null;

type UiThemeMode = 'system' | 'light' | 'dark';

export const uiThemeMode = ref<UiThemeMode>('system');

const normalizeUiThemeMode = (value: string): UiThemeMode => {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }

  return 'system';
};

const getSystemPrefersDark = () => {
  if (!systemThemeQuery.value) {
    systemThemeQuery.value = window.matchMedia('(prefers-color-scheme: dark)');
  }

  return systemThemeQuery.value.matches;
};

const applyDomThemeClass = (isDark: boolean) => {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add(THEME_CLASS);
    return;
  }

  root.classList.remove(THEME_CLASS);
};

const getIsDark = (mode: UiThemeMode) => {
  if (mode === 'dark') {
    return true;
  }

  if (mode === 'light') {
    return false;
  }

  return getSystemPrefersDark();
};

const watchSystemTheme = () => {
  const query = systemThemeQuery.value;
  if (!query) {
    return;
  }

  const handleChange = () => {
    if (uiThemeMode.value !== 'system') {
      return;
    }

    applyDomThemeClass(getIsDark('system'));
  };

  if (removeSystemThemeListener) {
    removeSystemThemeListener();
    removeSystemThemeListener = null;
  }

  if (query.addEventListener) {
    query.addEventListener('change', handleChange);
    removeSystemThemeListener = () => query.removeEventListener('change', handleChange);
    return;
  }

  query.addListener(handleChange);
  removeSystemThemeListener = () => query.removeListener(handleChange);
};

export const applyUiTheme = (mode: UiThemeMode) => {
  uiThemeMode.value = mode;

  applyDomThemeClass(getIsDark(mode));

  if (mode === 'system') {
    watchSystemTheme();
    return;
  }

  if (removeSystemThemeListener) {
    removeSystemThemeListener();
    removeSystemThemeListener = null;
  }
};

export const loadUiTheme = async () => {
  const theme = await invoke<string>('get_ui_theme');
  applyUiTheme(normalizeUiThemeMode(theme));
};

export const persistUiTheme = async (mode: UiThemeMode) => {
  await invoke('set_ui_theme', { theme: mode });
};
