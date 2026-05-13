import type * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';

export type EditorThemeName = 'vs' | 'vscode-dark-plus';

export const registerEditorThemes = (monacoInstance: typeof monaco) => {
  monacoInstance.editor.defineTheme('vscode-dark-plus', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {},
  });
};
