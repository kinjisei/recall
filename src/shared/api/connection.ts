// ============================================================================
// «Это связь?» — одно место, где решается, что сбой случился из-за сети, а не
// из-за ответа сервера (PLAN.md Ф1.13).
//
// Зачем. Без сети экраны врали: «Серия дней подряд 0», «Квестов пока нет»,
// учителю — «Включи режим преподавателя», после ночи без сети — форма
// регистрации. Каждый из них по-своему решал (или не решал), что ошибка —
// это «пусто». Здесь общий ответ, по которому экран говорит «похоже, пропала
// связь» и даёт «Повторить», а не выдумывает состояние.
//
// Модуль без импортов: его проверяет чистый тест scripts/test-connection.mjs.
// ============================================================================

/** Что пишет fetch без сети: Chrome, Firefox, Safari, node-fetch. */
export const NETWORK_MESSAGE = /failed to fetch|networkerror|network request failed|load failed|fetcherror/i

/** Ленивый кусок приложения не скачался: Chrome, Firefox, Safari, старый текст webpack. */
const CHUNK_MESSAGE = /dynamically imported module|importing a module script failed|chunkloaderror|loading chunk/i

/** Текст для человека: раздел ещё не скачан, а сети нет. */
export const CHUNK_OFFLINE_TEXT =
  'Этот раздел ещё не скачан на устройство — откроется, когда появится интернет.'

function readMessage(err: unknown): string {
  if (typeof err === 'string') return err
  const m = (err as { message?: unknown } | null)?.message
  return typeof m === 'string' ? m : ''
}

function readName(err: unknown): string {
  const n = (err as { name?: unknown } | null)?.name
  return typeof n === 'string' ? n : ''
}

/** Ленивый кусок приложения не скачался (раздел ещё не открывали в этой версии, сети нет). */
export function isChunkLoadError(err: unknown): boolean {
  return CHUNK_MESSAGE.test(readMessage(err))
}

/**
 * Сбой из-за связи: нет сети, сервер не ответил вовремя (LoadTimeoutError из
 * shared/lib/settleAll — сверяем по имени, чтобы модуль остался без импортов),
 * вход не обновился без сети (AuthRetryableFetchError клиента Supabase),
 * раздел не скачан.
 */
export function isConnectionError(err: unknown): boolean {
  const name = readName(err)
  if (name === 'LoadTimeoutError' || name === 'AuthRetryableFetchError') return true
  return NETWORK_MESSAGE.test(readMessage(err)) || isChunkLoadError(err)
}
