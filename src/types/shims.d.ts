// Типы-заглушки для модулей без деклараций (ленивые парсеры «Моих текстов»).
declare module 'mammoth/mammoth.browser' {
  export function extractRawText(o: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>
}
