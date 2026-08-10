// ============================================================================
// Память «Диалога».
//
// Половина этой фичи существовала с самого начала: реплики исправно писались в
// conversations/messages — и никогда не читались обратно. Стоило уйти со экрана
// посмотреть слово или урок, и чат начинался заново. Для тренировки разговора
// это обессмысливает сам разговор.
//
// Хранение — в базе, а не в localStorage: данные там уже лежали, RLS настроен,
// и переписка продолжается с телефона на ноутбуке. Ради этого же и колонка
// lang: у английского и испанского чата истории разные.
// ============================================================================
import { supabase } from './supabase'
import type { AppLang, ChatTurn } from '../types'

/** Сколько последних реплик поднимаем на экран. */
const HISTORY_LIMIT = 40

interface LoadedChat {
  id: string
  turns: ChatTurn[]
}

/**
 * ⚠️ Колонка lang добавляется отдельной миграцией. Пока схема не залита,
 * запрос с фильтром по ней падает — тогда работаем без разделения языков,
 * а не роняем экран. Тот же приём, что в lib/profile.ts (selectProfiles).
 */
async function lastConversationId(userId: string, lang: AppLang): Promise<string | null> {
  // ⚠️ Приведение: database.types.ts сгенерированы до колонки lang. Уйдёт,
  // когда типы перегенерируют после заливки схемы (ARCHITECTURE §5).
  const byLang = await (supabase.from('conversations').select('id') as never as {
    eq: (c: string, v: string) => {
      eq: (c: string, v: string) => {
        order: (c: string, o: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: { id: string }[] | null; error: unknown }>
        }
      }
    }
  })
    .eq('user_id', userId)
    .eq('lang', lang)
    .order('started_at', { ascending: false })
    .limit(1)
  if (!byLang.error) return (byLang.data?.[0]?.id as string | undefined) ?? null

  const any = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(1)
  if (any.error) return null
  return (any.data?.[0]?.id as string | undefined) ?? null
}

/** Последняя переписка этого языка. null — начинаем с чистого листа. */
export async function loadLastChat(userId: string, lang: AppLang): Promise<LoadedChat | null> {
  try {
    const id = await lastConversationId(userId, lang)
    if (!id) return null
    // ⚠️ Вторая сортировка по role — не украшение, а починка УЖЕ СОХРАНЁННЫХ
    // переписок. Пара «вопрос + ответ» долго писалась одним insert-ом, и обе
    // строки получали одинаковый created_at (now() в Postgres — время
    // транзакции). Порядок внутри пары становился произвольным, и чат
    // открывался вывернутым: сначала ответ AI, под ним вопрос к нему.
    // По убыванию 'user' идёт раньше 'assistant' — то есть в паре вопрос
    // впереди. Когда времена разные (новые записи), эта сортировка не влияет.
    const { data, error } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .order('role', { ascending: true })
      .limit(HISTORY_LIMIT)
    if (error) throw error
    const turns = (data ?? [])
      .slice()
      .reverse()
      .filter((m): m is { role: 'user' | 'assistant'; content: string; created_at: string } =>
        (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
      )
      .map((m) => ({ role: m.role, content: m.content }))
    return { id, turns }
  } catch {
    // память — удобство, а не условие работы: не смогли поднять — начинаем чат
    return null
  }
}

/**
 * Начать новую переписку.
 *
 * Пустая строка создаётся СРАЗУ, а не при первой реплике: иначе «Начать
 * заново» выглядело бы сломанным — стоило выйти и вернуться, и самой свежей
 * переписью оказывалась бы прежняя, с которой человек только что попрощался.
 */
export async function startNewChat(userId: string, lang: AppLang): Promise<string | null> {
  const withLang = await supabase
    .from('conversations')
    .insert({ user_id: userId, lang } as never)
    .select('id')
    .single()
  if (!withLang.error) return (withLang.data?.id as string | undefined) ?? null

  const plain = await supabase
    .from('conversations')
    .insert({ user_id: userId })
    .select('id')
    .single()
  if (plain.error) return null
  return (plain.data?.id as string | undefined) ?? null
}
