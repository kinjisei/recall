// ============================================================================
// Фаза 4: режим «Преподаватель».
//   Преподаватель: код-приглашение, список учениц с прогрессом, назначение колод.
//   Ученица: привязка по коду (RPC join_teacher), список своих преподавателей.
// Доступы разруливает RLS (docs/schema.sql, блок «ФАЗА 4»).
// ============================================================================
import { supabase } from './supabase'
import type { Deck, Profile } from '../types'

/** Сводка по ученице для экрана преподавателя. */
export interface StudentInfo {
  profile: Profile
  streak: number
  doneToday: boolean
  weekItems: number
  assignedDeckIds: string[]
}

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Нет авторизации')
  return user.id
}

/** YYYY-MM-DD в местном времени (offsetDays: 0 — сегодня, -1 — вчера…). */
function localDay(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dd}`
}

/** Стрик по множеству дней с активностью (вчерашняя серия ещё жива). */
function streakFromDays(days: Set<string>): number {
  const start = days.has(localDay(0)) ? 0 : days.has(localDay(-1)) ? -1 : null
  if (start === null) return 0
  let streak = 0
  let offset = start
  while (days.has(localDay(offset))) {
    streak++
    offset--
  }
  return streak
}

/**
 * Код-приглашение текущего преподавателя. Если кода ещё нет — генерирует
 * (6 символов без похожих букв) и сохраняет в профиль.
 */
export async function getOrCreateInviteCode(): Promise<string> {
  const userId = await requireUserId()

  const { data: me, error } = await supabase
    .from('profiles')
    .select('invite_code')
    .eq('id', userId)
    .single()
  if (error) throw error
  if (me?.invite_code) return me.invite_code as string

  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from(
      { length: 6 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join('')
    const { error: upErr } = await supabase
      .from('profiles')
      .update({ invite_code: code })
      .eq('id', userId)
    if (!upErr) return code
    // 23505 = unique violation: код занят, пробуем другой
    if (!upErr.message.includes('duplicate')) throw upErr
  }
  throw new Error('Не удалось сгенерировать код. Попробуй ещё раз.')
}

/** Ученица вводит код → привязка. Возвращает имя преподавателя. */
export async function joinTeacher(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_teacher', {
    code: code.trim(),
  })
  if (error) throw new Error(error.message)
  return (data as string) ?? 'Преподаватель'
}

/** Преподаватели текущей ученицы (обычно один). */
export async function getMyTeachers(): Promise<Profile[]> {
  const userId = await requireUserId()
  const { data: links, error } = await supabase
    .from('teacher_students')
    .select('teacher_id')
    .eq('student_id', userId)
  if (error) throw error
  const ids = (links ?? []).map((l) => l.teacher_id as string)
  if (ids.length === 0) return []

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .in('id', ids)
  if (pErr) throw pErr
  return (profiles ?? []) as Profile[]
}

/** Все колоды текущего пользователя (для назначения ученицам). */
export async function getMyDecks(): Promise<Deck[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('decks')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Deck[]
}

/** Ученицы текущего преподавателя со сводкой прогресса. */
export async function getMyStudents(): Promise<StudentInfo[]> {
  const userId = await requireUserId()

  const { data: links, error } = await supabase
    .from('teacher_students')
    .select('student_id')
    .eq('teacher_id', userId)
  if (error) throw error
  const ids = (links ?? []).map((l) => l.student_id as string)
  if (ids.length === 0) return []

  const [profilesRes, activityRes, assignRes] = await Promise.all([
    supabase.from('profiles').select('*').in('id', ids),
    supabase
      .from('activity_log')
      .select('user_id, day, items_done')
      .in('user_id', ids)
      .gte('day', localDay(-60)),
    supabase.from('deck_assignments').select('deck_id, student_id').in('student_id', ids),
  ])
  if (profilesRes.error) throw profilesRes.error
  if (activityRes.error) throw activityRes.error
  if (assignRes.error) throw assignRes.error

  const activity = activityRes.data ?? []
  const weekFrom = localDay(-6)

  return ((profilesRes.data ?? []) as Profile[]).map((profile) => {
    const mine = activity.filter((a) => a.user_id === profile.id)
    const days = new Set(mine.map((a) => a.day as string))
    const weekItems = mine
      .filter((a) => (a.day as string) >= weekFrom)
      .reduce((n, a) => n + ((a.items_done as number) ?? 0), 0)
    return {
      profile,
      streak: streakFromDays(days),
      doneToday: days.has(localDay(0)),
      weekItems,
      assignedDeckIds: (assignRes.data ?? [])
        .filter((a) => a.student_id === profile.id)
        .map((a) => a.deck_id as string),
    }
  })
}

/** Назначить колоду ученице. */
export async function assignDeck(deckId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from('deck_assignments')
    .insert({ deck_id: deckId, student_id: studentId })
  if (error && !error.message.includes('duplicate')) throw error
}

/** Снять назначение колоды. */
export async function unassignDeck(deckId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from('deck_assignments')
    .delete()
    .eq('deck_id', deckId)
    .eq('student_id', studentId)
  if (error) throw error
}
