import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { TagModule } from 'primeng/tag';
import { Router } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { getErrorMessage } from '../../utils';
import { UiThemeMode, UiThemeService } from '../ui-theme.service';
import { EditorThemeName, registerEditorThemes } from '../monaco/themes';
import type * as monaco from 'monaco-editor';

declare global {
  interface Window {
    require?: {
      config: (options: { paths: Record<string, string> }) => void;
      (modules: string[], onLoad: (monacoInstance: typeof monaco) => void, onError?: unknown): void;
    };
  }
}

type EditorWordWrap = 'on' | 'off';

@Component({
  selector: 'app-editor',
  imports: [
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    MessageModule,
    SkeletonModule,
    TagModule,
    ToastModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './editor.html',
})
export default class Editor implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly uiTheme = inject(UiThemeService);
  private readonly appWindow = getCurrentWindow();

  private monaco?: typeof monaco;
  private monacoLoadPromise?: Promise<typeof monaco>;
  private editorContainer: HTMLDivElement | null = null;
  private editor?: monaco.editor.IStandaloneCodeEditor;
  private model?: monaco.editor.ITextModel;
  private resizeObserver?: ResizeObserver;
  private formatProviderDisposable?: monaco.IDisposable;
  private unlistenSelectedChange?: () => void;
  private unlistenCloseRequested?: () => void;
  private systemThemeQuery?: MediaQueryList;
  private removeSystemThemeListener?: () => void;
  private suppressModelUpdate = false;
  private isLeaveConfirmOpen = false;

  protected readonly currentFilePath = signal('');
  protected readonly savedContent = signal('');
  protected readonly draftContent = signal('');
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly isFormatting = signal(false);
  protected readonly loadError = signal('');
  protected readonly isSwitchDialogVisible = signal(false);
  protected readonly pendingFilePath = signal<string | null>(null);
  protected readonly ignoreSelectedChangePath = signal('');
  protected readonly editorWordWrap = signal<EditorWordWrap>('on');
  protected readonly hasLoadedEditorPreferences = signal(false);

  protected readonly isDirty = computed(() => this.draftContent() !== this.savedContent());
  protected readonly hasSelectedFile = computed(() => this.currentFilePath().length > 0);
  protected readonly statusText = computed(() => {
    if (this.loadError()) {
      return '加载失败';
    }

    return this.isDirty() ? '未保存' : '已保存';
  });
  protected readonly statusSeverity = computed(() => (this.isDirty() ? 'warn' : 'success'));

  @ViewChild('editorContainer')
  set editorContainerRef(ref: ElementRef<HTMLDivElement> | undefined) {
    this.editorContainer = ref?.nativeElement ?? null;
    queueMicrotask(() => {
      void this.initEditor();
    });
  }

  constructor() {
    effect(() => {
      this.applyUiThemeToEditorTheme(this.uiTheme.mode());
    });
  }

  async ngOnInit() {
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    this.unlistenCloseRequested = await this.appWindow.onCloseRequested(async (event) => {
      if (!this.isDirty()) {
        return;
      }

      const shouldLeave = await this.confirmLeaveEditor();
      if (!shouldLeave) {
        event.preventDefault();
      }
    });

    this.unlistenSelectedChange = await listen<string>('selected-change', async (event) => {
      await this.handleSelectedChange(event.payload);
    });

    await this.loadEditorPreferences();
    await this.loadCurrentSelection();
  }

  ngOnDestroy() {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    this.stopSystemThemeListener();
    this.unlistenSelectedChange?.();
    this.unlistenCloseRequested?.();
    this.disposeEditor();
  }

  async canDeactivateEditor() {
    return await this.confirmLeaveEditor();
  }

  protected async navigateToConf() {
    await this.router.navigateByUrl('/conf');
  }

  protected async reloadContent() {
    if (!this.hasSelectedFile()) {
      return;
    }

    if (this.isDirty()) {
      const shouldReload = await this.requestConfirmation({
        message: '重新加载会丢弃当前未保存修改，是否继续？',
        header: '提示',
        acceptLabel: '继续加载',
        rejectLabel: '取消',
      });

      if (!shouldReload) {
        return;
      }
    }

    await this.readSelectedFile(this.currentFilePath());
  }

  protected async saveAndSwitch() {
    const nextPath = this.pendingFilePath();
    const didSave = await this.saveContent();
    if (!didSave) {
      return;
    }

    this.isSwitchDialogVisible.set(false);
    this.pendingFilePath.set(null);

    if (!nextPath) {
      this.resetEditorState();
      return;
    }

    await this.readSelectedFile(nextPath);
  }

  protected async discardAndSwitch() {
    const nextPath = this.pendingFilePath();
    this.isSwitchDialogVisible.set(false);
    this.pendingFilePath.set(null);

    if (!nextPath) {
      this.resetEditorState();
      return;
    }

    await this.readSelectedFile(nextPath);
  }

  protected async cancelSwitch() {
    const previousPath = this.currentFilePath();
    this.isSwitchDialogVisible.set(false);
    this.pendingFilePath.set(null);

    if (!previousPath) {
      return;
    }

    this.ignoreSelectedChangePath.set(previousPath);
    await invoke('set_selected_file', { filePath: previousPath });
  }

  private showSuccess(message: string) {
    this.toast.add({ severity: 'success', summary: message, life: 3000 });
  }

  private showError(message: string) {
    this.toast.add({ severity: 'error', summary: '错误', detail: message, life: 5000 });
  }

  private requestConfirmation(options: {
    message: string;
    header: string;
    acceptLabel: string;
    rejectLabel: string;
  }) {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(value);
      };

      this.confirm.confirm({
        message: options.message,
        header: options.header,
        acceptLabel: options.acceptLabel,
        rejectLabel: options.rejectLabel,
        defaultFocus: 'reject',
        rejectButtonProps: { severity: 'secondary', outlined: true },
        acceptButtonProps: { severity: 'warn' },
        accept: () => settle(true),
        reject: () => settle(false),
        closeOnEscape: false,
      });
    });
  }

  private normalizeWordWrap(value: string): EditorWordWrap {
    return value === 'off' ? 'off' : 'on';
  }

  private getNextWordWrap(): EditorWordWrap {
    return this.editorWordWrap() === 'on' ? 'off' : 'on';
  }

  private applyEditorWordWrap(wordWrap: EditorWordWrap) {
    this.editorWordWrap.set(wordWrap);
    this.editor?.updateOptions({ wordWrap });
  }

  private getSystemEditorTheme(matchesDark: boolean): EditorThemeName {
    return matchesDark ? 'vscode-dark-plus' : 'vs';
  }

  private applySystemEditorTheme() {
    if (this.uiTheme.mode() === 'system' && this.monaco) {
      this.monaco.editor.setTheme(
        this.getSystemEditorTheme(this.systemThemeQuery?.matches ?? false),
      );
    }
  }

  private stopSystemThemeListener() {
    this.removeSystemThemeListener?.();
    this.removeSystemThemeListener = undefined;
    this.systemThemeQuery = undefined;
  }

  private watchSystemEditorTheme() {
    this.stopSystemThemeListener();

    this.systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.applySystemEditorTheme();

    const handleSystemThemeChange = () => {
      this.applySystemEditorTheme();
    };

    if (this.systemThemeQuery.addEventListener) {
      this.systemThemeQuery.addEventListener('change', handleSystemThemeChange);
      this.removeSystemThemeListener = () => {
        this.systemThemeQuery?.removeEventListener('change', handleSystemThemeChange);
      };
      return;
    }

    this.systemThemeQuery.addListener(handleSystemThemeChange);
    this.removeSystemThemeListener = () => {
      this.systemThemeQuery?.removeListener(handleSystemThemeChange);
    };
  }

  private applyUiThemeToEditorTheme(mode: UiThemeMode) {
    if (mode === 'system') {
      this.watchSystemEditorTheme();
      return;
    }

    this.stopSystemThemeListener();
    this.monaco?.editor.setTheme(mode === 'dark' ? 'vscode-dark-plus' : 'vs');
  }

  private async persistEditorWordWrap(wordWrap: EditorWordWrap) {
    try {
      await invoke('set_editor_word_wrap', { wordWrap });
    } catch (error) {
      this.showError(`配置保存失败: ${getErrorMessage(error)}`);
    }
  }

  private async toggleEditorWordWrap() {
    const nextWordWrap = this.getNextWordWrap();
    this.applyEditorWordWrap(nextWordWrap);
    await this.persistEditorWordWrap(nextWordWrap);
  }

  private syncEditorValue(value: string) {
    if (!this.model || this.model.getValue() === value) {
      return;
    }

    this.suppressModelUpdate = true;
    this.model.setValue(value);
    this.suppressModelUpdate = false;
  }

  private applyLoadedContent(filePath: string, content: string) {
    this.currentFilePath.set(filePath);
    this.savedContent.set(content);
    this.draftContent.set(content);
    this.loadError.set('');
    this.syncEditorValue(content);
  }

  private resetEditorState(filePath = '') {
    this.currentFilePath.set(filePath);
    this.savedContent.set('');
    this.draftContent.set('');
    this.loadError.set('');
    this.syncEditorValue('');

    if (!filePath) {
      this.disposeEditor();
    }
  }

  private async readSelectedFile(filePath: string) {
    this.isLoading.set(true);

    try {
      const content = await invoke<string>('read_selected_file_content');
      this.applyLoadedContent(filePath, content);
    } catch (error) {
      this.loadError.set(getErrorMessage(error));
      this.currentFilePath.set(filePath);
      this.savedContent.set('');
      this.draftContent.set('');
      this.syncEditorValue('');
      this.disposeEditor();
    } finally {
      this.isLoading.set(false);
      queueMicrotask(() => this.editor?.layout());
    }
  }

  private async loadCurrentSelection() {
    try {
      const selectedFilePath = await invoke<string>('get_selected_file');

      if (!selectedFilePath) {
        this.resetEditorState();
        return;
      }

      await this.readSelectedFile(selectedFilePath);
    } catch (error) {
      const message = getErrorMessage(error);
      this.resetEditorState();
      this.loadError.set(message);
      this.showError(`文件选择状态加载失败: ${message}`);
    }
  }

  private async loadEditorPreferences() {
    try {
      const wordWrap = await invoke<string>('get_editor_word_wrap');
      this.applyEditorWordWrap(this.normalizeWordWrap(wordWrap));
    } catch (error) {
      const message = getErrorMessage(error);
      this.showError(`编辑器配置加载失败: ${message}`);
      this.applyEditorWordWrap('on');
    } finally {
      this.hasLoadedEditorPreferences.set(true);
      queueMicrotask(() => {
        void this.initEditor();
      });
    }
  }

  private async saveContent() {
    if (!this.currentFilePath() || !this.hasSelectedFile() || !this.isDirty()) {
      return true;
    }

    this.isSaving.set(true);

    try {
      await invoke('write_selected_file_content', { content: this.draftContent() });
      this.savedContent.set(this.draftContent());
      this.showSuccess('文件已保存');
      return true;
    } catch (error) {
      this.showError(getErrorMessage(error));
      return false;
    } finally {
      this.isSaving.set(false);
    }
  }

  private async formatMarkdown(source: string) {
    const [prettier, markdownPlugin] = await Promise.all([
      import('prettier-v2/standalone'),
      import('prettier-v2/parser-markdown'),
    ]);
    const prettierModule = prettier.default ?? prettier;

    return prettierModule.format(source, {
      parser: 'markdown',
      plugins: [markdownPlugin.default ?? markdownPlugin],
    });
  }

  private async confirmLeaveEditor() {
    if (!this.isDirty()) {
      return true;
    }

    if (this.isLeaveConfirmOpen) {
      return false;
    }

    this.isLeaveConfirmOpen = true;

    try {
      return await this.requestConfirmation({
        message: '当前内容未保存，继续离开将丢失修改。是否继续离开当前页面？',
        header: '未保存修改',
        acceptLabel: '继续离开',
        rejectLabel: '留在当前页面',
      });
    } finally {
      this.isLeaveConfirmOpen = false;
    }
  }

  private readonly handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!this.isDirty()) {
      return;
    }

    event.preventDefault();
    event.returnValue = '';
  };

  private async handleSelectedChange(nextPath: string) {
    if (this.ignoreSelectedChangePath() && nextPath === this.ignoreSelectedChangePath()) {
      this.ignoreSelectedChangePath.set('');
      return;
    }

    if (nextPath === this.currentFilePath()) {
      return;
    }

    if (!nextPath) {
      if (this.isDirty() && this.currentFilePath()) {
        this.pendingFilePath.set('');
        this.isSwitchDialogVisible.set(true);
        return;
      }

      this.resetEditorState();
      return;
    }

    if (this.isDirty() && this.currentFilePath()) {
      this.pendingFilePath.set(nextPath);
      this.isSwitchDialogVisible.set(true);
      return;
    }

    await this.readSelectedFile(nextPath);
  }

  private loadMonaco() {
    if (this.monaco) {
      return Promise.resolve(this.monaco);
    }

    if (this.monacoLoadPromise) {
      return this.monacoLoadPromise;
    }

    this.monacoLoadPromise = new Promise<typeof monaco>((resolve, reject) => {
      const monacoBaseUrl = new URL('assets/monaco/vs', document.baseURI).toString();
      const monacoLoaderUrl = new URL('loader.js', `${monacoBaseUrl}/`).toString();

      const loadEditor = () => {
        if (!window.require) {
          reject(new Error('Monaco AMD loader is unavailable'));
          return;
        }

        window.require.config({ paths: { vs: monacoBaseUrl } });
        window.require(
          ['vs/editor/editor.main'],
          (monacoInstance) => {
            this.monaco = monacoInstance;
            registerEditorThemes(monacoInstance);
            this.applyUiThemeToEditorTheme(this.uiTheme.mode());
            resolve(monacoInstance);
          },
          reject,
        );
      };

      if (window.require) {
        loadEditor();
        return;
      }

      const script = document.createElement('script');
      script.src = monacoLoaderUrl;
      script.onload = loadEditor;
      script.onerror = () => reject(new Error('Failed to load Monaco AMD loader'));
      document.body.appendChild(script);
    });

    return this.monacoLoadPromise;
  }

  private async initEditor() {
    if (!this.editorContainer || this.editor || this.model || !this.hasLoadedEditorPreferences()) {
      return;
    }

    let monacoInstance: typeof monaco;
    try {
      monacoInstance = await this.loadMonaco();
    } catch (error) {
      const message = getErrorMessage(error);
      this.loadError.set(message);
      this.showError(`编辑器加载失败: ${message}`);
      return;
    }

    this.applyUiThemeToEditorTheme(this.uiTheme.mode());
    this.model = monacoInstance.editor.createModel(this.draftContent(), 'markdown');
    this.editor = monacoInstance.editor.create(this.editorContainer, {
      model: this.model,
      automaticLayout: false,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: this.editorWordWrap(),
      tabSize: 2,
      fontSize: 14,
    });

    this.editor.addAction({
      id: 'editor.action.toggleWordWrap',
      label: 'Toggle Word Wrap',
      keybindings: [monacoInstance.KeyMod.Alt | monacoInstance.KeyCode.KeyZ],
      run: async () => {
        await this.toggleEditorWordWrap();
      },
    });

    this.editor.addAction({
      id: 'editor.action.saveMarkdown',
      label: 'Save Markdown',
      keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS],
      run: async () => {
        await this.saveContent();
      },
    });

    this.model.onDidChangeContent(() => {
      if (this.suppressModelUpdate || !this.model) {
        return;
      }

      this.draftContent.set(this.model.getValue());
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.editor?.layout();
    });
    this.resizeObserver.observe(this.editorContainer);

    this.formatProviderDisposable?.dispose();
    this.formatProviderDisposable = monacoInstance.languages.registerDocumentFormattingEditProvider(
      'markdown',
      {
        provideDocumentFormattingEdits: async (currentModel) => {
          if (this.isFormatting()) {
            return [];
          }

          this.isFormatting.set(true);

          try {
            const source = currentModel.getValue();
            const formattedContent = await this.formatMarkdown(source);

            if (formattedContent === source) {
              return [];
            }

            return [
              {
                range: currentModel.getFullModelRange(),
                text: formattedContent,
              },
            ];
          } catch (error) {
            this.showError(`格式化失败: ${getErrorMessage(error)}`);
            return [];
          } finally {
            this.isFormatting.set(false);
          }
        },
      },
    );
  }

  private disposeEditor() {
    this.formatProviderDisposable?.dispose();
    this.formatProviderDisposable = undefined;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.editor?.dispose();
    this.editor = undefined;
    this.model?.dispose();
    this.model = undefined;
  }
}
