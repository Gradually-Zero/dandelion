import type * as monaco from 'monaco-editor';

export const DEFAULT_EDITOR_THEME = 'vs';

export type EditorThemeName = 'vs' | 'vscode-dark-plus';

export const normalizeEditorTheme = (theme: string): EditorThemeName => {
  return theme === 'vscode-dark-plus' ? 'vscode-dark-plus' : DEFAULT_EDITOR_THEME;
};

export const registerEditorThemes = (monacoInstance: typeof monaco) => {
  monacoInstance.editor.defineTheme('vscode-dark-plus', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {},
  });
};
