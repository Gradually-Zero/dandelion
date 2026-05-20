import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { LucideMoon, LucideSun, LucideSunMoon } from '@lucide/angular';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { SelectButtonChangeEvent, SelectButtonModule } from 'primeng/selectbutton';
import { UiThemeMode, UiThemeService } from '../ui-theme.service';

interface ThemeOption {
  value: UiThemeMode;
}

@Component({
  selector: 'app-conf',
  imports: [FormsModule, ButtonModule, SelectButtonModule, LucideMoon, LucideSun, LucideSunMoon],
  templateUrl: './conf.html',
})
export default class Conf implements OnInit, OnDestroy {
  private readonly uiTheme = inject(UiThemeService);
  private unlistenSelectedChange?: () => void;

  protected readonly selectedFile = signal('');
  protected readonly uiThemeMode = this.uiTheme.mode;
  protected readonly themeOptions: ThemeOption[] = [
    { value: 'system' },
    { value: 'light' },
    { value: 'dark' },
  ];

  async ngOnInit() {
    try {
      this.unlistenSelectedChange = await listen<string>('selected-change', (event) => {
        this.selectedFile.set(event.payload);
      });
      this.selectedFile.set(await invoke<string>('get_selected_file'));
    } catch (error) {
      console.error('Error fetching selected file:', error);
    }
  }

  ngOnDestroy() {
    this.unlistenSelectedChange?.();
  }

  protected async selectFile() {
    try {
      const selectedPath = await open({
        filters: [{ name: 'Markdown 文件', extensions: ['md'] }],
        multiple: false,
      });

      if (!selectedPath || Array.isArray(selectedPath)) {
        return;
      }

      await invoke('set_selected_file', { filePath: selectedPath });
    } catch (error) {
      console.error('选择文件失败:', error);
    }
  }

  protected async changeUiTheme(event: SelectButtonChangeEvent) {
    const mode = event.value as UiThemeMode;
    this.uiTheme.applyUiTheme(mode);
    await this.uiTheme.persistUiTheme(mode);
  }
}
