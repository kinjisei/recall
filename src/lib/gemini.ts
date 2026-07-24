// ============================================================================
// AI — клиент нашего прокси /api/gemini. Ключ живёт ТОЛЬКО на сервере;
// фронт никогда не ходит в Google напрямую.
// Контракт: docs/ARCHITECTURE.md §7 — chat(messages, opts).
// ============================================================================
import type { AiTask, ChatTurn } from '../types'
import { supabase } from './supabase'

/**
 * Отправляет переписку в /api/gemini и возвращает текст ответа AI.
 *
 * task — ЧТО мы просим сделать (перевод слова, реплика Диалога, генерация
 * материала…). Модель, карман суточной квоты и право на вызов сервер выбирает
 * сам по этому типу — карта в api/_tasks.ts. Клиент уровень модели НЕ задаёт:
 * пока он слал tier, любой вошедший мог отправить обычную реплику Диалога с
 * tier:'max' и жечь дефицитные Pro-модели (пентест, заход 18).
 */
export async function chat(
  messages: ChatTurn[],
  opts: { task: AiTask; system?: string },
): Promise<string> {
  // токен сессии — прокси пускает только вошедших (защита квоты от абьюза)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  let res: Response
  try {
    res = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        messages,
        system: opts.system,
        // модель и лимиты сервер подбирает сам по типу задачи
        task: opts.task,
      }),
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
