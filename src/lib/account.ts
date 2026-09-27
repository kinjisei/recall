// ============================================================================
// Аккаунт: экспорт своих данных и самоудаление (хвост блока 5).
//
// Экспорт собирается на КЛИЕНТЕ по обычным RLS-запросам (каждый видит только
// своё) — схему трогать не нужно. Удаление идёт через RPC delete_my_account:
// сервер стирает строку auth.users, всё остальное уходит каскадом.
// ============================================================================
import { supabase, currentUserId } from './supabase'
import { dbError } from './dbError'
import { clearUserLocalData, PROFILE_COLUMNS } from './profile'

/** Собрать все свои данные в один объект. Пусто где нет доступа/строк. */
export async function collectMyData(): Promise<Record<string, unknown>> {
  const uid = await currentUserId()
  if (!uid) throw new Error('Нужно войти в аккаунт.')

  // Каждый запрос — только своё (RLS). Ошибку отдельной таблицы не роняем на
  // весь экспорт: кладём [], чтобы человек получил хоть что-то.
  const safe = async <T>(p: PromiseLike<{ data: T[] | null }>): Promise<T[]> => {
    try {
      const { data } = await p
      return data ?? []
    } catch {
      return []
    }
  }

  const [profile, decks, cards, reviews, writing, activity, conversations, messages, mistakes] =
    await Promise.all([
      safe(supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', uid)),
      safe(supabase.from('decks').select('id, title, lang, created_at').eq('owner_id', uid)),
      safe(supabase.from('cards').select('id, deck_id, front, back, example, source, created_at')),
      safe(supabase.from('review_states').select('card_id, due, last_review, reps, lapses, state').eq('user_id', uid)),
      safe(supabase.from('writing_submissions').select('prompt, text, feedback, created_at').eq('user_id', uid)),
      safe(supabase.from('activity_log').select('day, type, items_done, duration_sec').eq('user_id', uid)),
      safe(supabase.from('conversations').select('id, lang, started_at').eq('user_id', uid)),
      safe(supabase.from('messages').select('conversation_id, role, content, created_at')),
      safe(supabase.from('grammar_mistakes').select('lang, topic_id, ex, created_at').eq('user_id', uid)),
    ])

  return {
    exported_at: new Date().toISOString(),
    user_id: uid,
    profile: profile[0] ?? null,
    decks,
    cards,
    review_states: reviews,
    writing_submissions: writing,
    activity_log: activity,
    conversations,
    messages,
    grammar_mistakes: mistakes,
  }
}

/** Собрать данные и отдать файлом recall-data-<дата>.json. */
export async function downloadMyData(): Promise<void> {
  const data = await collectMyData()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `recall-data-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // отзываем URL чуть позже — иначе Safari успевает отменить скачивание
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/**
 * Удалить свой аккаунт целиком. Сервер стирает auth.users → профиль и все
 * данные уходят каскадом. После — выходим и чистим локальные данные устройства.
 * Возврата нет: вызывающий экран обязан подтвердить намерение заранее.
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw dbError(error, 'удалить аккаунт')
  // токен ещё жив до истечения — глушим сессию сами, затем чистим устройство
  await supabase.auth.signOut().catch(() => {})
  clearUserLocalData()
}
