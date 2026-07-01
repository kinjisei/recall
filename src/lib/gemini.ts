// ============================================================================
// AI — клиент нашего прокси /api/gemini. Ключ живёт ТОЛЬКО на сервере;
// фронт никогда не ходит в Google напрямую.
// Контракт: docs/ARCHITECTURE.md §7 — chat(messages, opts).
// ============================================================================
import type { ChatTurn } from '../types'

/** Отправляет переписку в /api/gemini и возвращает текст ответа AI. */
export async function chat(
  messages: ChatTurn[],
  opts?: { system?: string },
): Promise<string> {
  let res: Response
  try {
    res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, system: opts?.system }),
    })
  } catch {
    throw new Error('Нет соединения с сервером AI. Проверь интернет.')
  }

  let data: { text?: string; error?: string } | null = null
  try {
    data = (await res.json()) as { text?: string; error?: string }
  } catch {
    /* ответ не JSON — обработаем ниже по статусу */
  }

  if (!res.ok) {
    throw new Error(data?.error ?? `Сервер AI ответил ошибкой ${res.status}`)
  }
  if (!data?.text) throw new Error('Пустой ответ от AI')
  return data.text
}
