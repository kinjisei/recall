/**
 * Заглушка `src/shared/api/ai.ts` для проверки качества AI (loader.mjs):
 * `chat` уходит в обработчик сервера через harness.mjs — тот же путь, что у
 * запроса из браузера, только без сети между ними.
 */
const bridge = () => {
  const b = globalThis.__aiQuality
  if (!b) throw new Error('chat вызван без harness.mjs')
  return b
}

export const chat = (messages, opts) => bridge().chat(messages, opts)
export const chatStream = () => {
  throw new Error('поток в проверке качества не нужен')
}
export const onAiRequest = () => {}
export const isNetworkError = () => false
