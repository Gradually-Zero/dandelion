declare module 'prettier-v2/standalone' {
  export interface PrettierStandalone {
    format(source: string, options: unknown): string;
  }

  export const format: PrettierStandalone['format'];
  const prettier: PrettierStandalone;
  export default prettier;
}

declare module 'prettier-v2/parser-markdown' {
  const plugin: unknown;
  export default plugin;
}
