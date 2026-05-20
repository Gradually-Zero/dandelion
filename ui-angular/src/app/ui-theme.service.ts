import { DOCUMENT } from '@angular/common';
import { invoke } from '@tauri-apps/api/core';
import { Injectable, inject, signal } from '@angular/core';

const THEME_CLASS = 'ddl-dark';

export type UiThemeMode = 'system' | 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class UiThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly modeSignal = signal<UiThemeMode>('system');
  private systemThemeQuery: MediaQueryList | null = null;
  private removeSystemThemeListener: (() => void) | null = null;

  readonly mode = this.modeSignal.asReadonly();

  async loadUiTheme() {
    const theme = await invoke<string>('get_ui_theme');
    this.applyUiTheme(this.normalizeUiThemeMode(theme));
  }

  applyUiTheme(mode: UiThemeMode) {
    this.modeSignal.set(mode);
    this.applyDomThemeClass(this.getIsDark(mode));

    if (mode === 'system') {
      this.watchSystemTheme();
      return;
    }

    this.stopWatchingSystemTheme();
  }

  async persistUiTheme(mode: UiThemeMode) {
    await invoke('set_ui_theme', { theme: mode });
  }

  private normalizeUiThemeMode(value: string): UiThemeMode {
    if (value === 'light' || value === 'dark' || value === 'system') {
      return value;
    }

    return 'system';
  }

  private getSystemPrefersDark() {
    if (!this.systemThemeQuery) {
      this.systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    }

    return this.systemThemeQuery.matches;
  }

  private getIsDark(mode: UiThemeMode) {
    if (mode === 'dark') {
      return true;
    }

    if (mode === 'light') {
      return false;
    }

    return this.getSystemPrefersDark();
  }

  private applyDomThemeClass(isDark: boolean) {
    const root = this.document.documentElement;
    if (isDark) {
      root.classList.add(THEME_CLASS);
      return;
    }

    root.classList.remove(THEME_CLASS);
  }

  private watchSystemTheme() {
    const query = this.systemThemeQuery;
    if (!query) {
      return;
    }

    const handleChange = () => {
      if (this.modeSignal() !== 'system') {
        return;
      }

      this.applyDomThemeClass(this.getIsDark('system'));
    };

    this.stopWatchingSystemTheme();

    if (query.addEventListener) {
      query.addEventListener('change', handleChange);
      this.removeSystemThemeListener = () => query.removeEventListener('change', handleChange);
      return;
    }

    query.addListener(handleChange);
    this.removeSystemThemeListener = () => query.removeListener(handleChange);
  }

  private stopWatchingSystemTheme() {
    this.removeSystemThemeListener?.();
    this.removeSystemThemeListener = null;
  }
}
