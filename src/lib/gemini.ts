// ============================================================================
// AI — клиент нашего прокси /api/gemini. Ключ живёт ТОЛЬКО на сервере;
// фронт никогда не ходит в Google напрямую.
// Контракт: docs/ARCHITECTURE.md §7 — chat(messages, opts).
// ============================================================================
import type { AiTask, ChatTurn } from '../types'
import { supabase } from './supabase'
import { track } from './analytics'

/**
 * Ошибка «запрос не дошёл до сервера» (нет интернета). Помечаем флагом, чтобы
 * защита «3 сбоя за час» (lib/aiHealth) НЕ считала её серверной: медленный или
 * пропавший интернет — не повод говорить «у AI проблемы на нашей стороне».
 */
function netError(): Error {
  const e = new Error('Нет соединения с сервером AI. Проверь интернет.') as Error & { net?: boolean }
  e.net = true
  return e
}

/** true — сбой из-за сети клиента, а не ответ-ошибка сервера. */
export function isNetworkError(e: unknown): boolean {
  return e instanceof Error && (e as Error & { net?: boolean }).net === true
}

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
  // одна точка на все AI-механики: любой экран, зовущий AI, попадает в воронку
  void track('ai_first', { task: opts.task })

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
    throw netError()
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

/**
 * Потоковый вариант chat() для «Диалога»: ответ приходит кусками, каждый кусок
 * отдаётся в onChunk — реплика появляется на глазах, а не ждётся целиком.
 * Возвращает полный собранный текст.
 *
 * ⚠️ Различаем два вида сбоя (это нужно защите «3 ошибки за час»):
 *   • fetch не дошёл → бросаем «проверь интернет» (это НЕ сервер);
 *   • сервер ответил ошибкой (до потока он отдаёт JSON) → бросаем его текст.
 * Сервер при сбое до первого куска возвращает энергию сам (правило «не
 * доставили — не берём»), клиенту остаётся только показать сообщение.
 */
export async function chatStream(
  messages: ChatTurn[],
  opts: { task: AiTask; system?: string },
  onChunk: (delta: string) => void,
): Promise<string> {
  void track('ai_first', { task: opts.task })

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
      body: JSON.stringify({ messages, system: opts.system, task: opts.task, stream: true }),
    })
  } catch {
    throw netError()
  }

  // Сбой ДО потока: сервер отдал JSON с ошибкой (и уже вернул энергию).
  if (!res.ok || !res.body) {
    let msg = `Сервер AI ответил ошибкой ${res.status}`
    try {
      const data = (await res.json()) as { error?: string }
      if (data?.error) msg = data.error
    } catch {
      /* ответ не JSON — оставляем общий текст */
    }
    throw new Error(msg)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      const delta = decoder.decode(value, { stream: true })
      if (delta) {
        full += delta
        onChunk(delta)
      }
    }
  } catch {
    // Поток оборвался на середине. Что успело прийти — уже показано; сервер
    // вернул энергию. Если совсем пусто — сообщаем об ошибке.
    if (!full) throw new Error('Ответ оборвался. Энергия не потрачена — попробуй ещё раз.')
  }
  if (!full) throw new Error('Пустой ответ от AI')
  return full
}
