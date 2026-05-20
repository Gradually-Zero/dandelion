declare module 'prettier-v2/standalone' {
  export function format(source: string, options: unknown): string;
}

declare module 'prettier-v2/parser-markdown' {
  const plugin: unknown;
  export default plugin;
}
