// ============================================================================
// Фаза 4: режим «Преподаватель».
//   Преподаватель: код-приглашение, список учеников с прогрессом, назначение колод.
//   Ученик: привязка по коду (RPC join_teacher), список своих преподавателей.
// Доступы разруливает RLS (docs/schema.sql, блок «ФАЗА 4»).
// ============================================================================
import { supabase, requireUserId } from './supabase'
import { dbError } from './dbError'
import { SUPPORT_EMAIL } from './contacts'
import { selectProfiles, invalidateProfile } from './profile'
import { track } from './analytics'
import type { Card, Deck, Profile } from '../types'

/** Сводка по ученику для экрана преподавателя. */
export interface StudentInfo {
  profile: Profile
  streak: number
  doneToday: boolean
  weekItems: number
  assignedDeckIds: string[]
  /** Занимает ли место тарифа (только оно даёт повышенные лимиты AI). */
  seat: boolean
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
 * Код-приглашение текущего преподавателя (генерирует при первом вызове).
 * Прямая запись invite_code в профиль запрещена RLS — только через RPC.
 */
export async function getOrCreateInviteCode(): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_invite_code')
  if (error) throw dbError(error, 'получить код приглашения')
  return data as string
}

/**
 * Выдаёт НОВЫЙ код-приглашение; старый сразу перестаёт работать.
 * Нужно, если код куда-то утёк (до захода 20 ученик мог прочитать его прямо
 * из профиля преподавателя) или его просто разослали лишним людям.
 * Уже привязанные ученики не отваливаются: связь живёт в teacher_students.
 */
export async function regenerateInviteCode(): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_invite_code')
  if (error) throw dbError(error, 'сменить код приглашения')
  return data as string
}

/**
 * Включить себе роль преподавателя (A1). Раньше роль выдавалась только вручную
 * SQL-ом, и попасть в студию самостоятельно было нельзя вообще.
 * Идемпотентно: повторный вызов ничего не ломает.
 */
export async function becomeTeacher(): Promise<void> {
  const { error } = await supabase.rpc('become_teacher')
  if (error) {
    // RPC ещё не залита в базу (деплой раньше миграции). Общий текст dbError
    // тут хуже: человеку важно знать, что путь всё-таки есть — роль включат
    // руками. Остальное (блокировка, сеть, права) разбирает dbError.
    if (error.code === 'PGRST202' || error.message.includes('become_teacher')) {
      console.error('[db] нет RPC become_teacher:', error)
      throw new Error(
        `Режим преподавателя пока включается вручную — напиши на ${SUPPORT_EMAIL}.`,
      )
    }
    throw dbError(error, 'включить режим преподавателя')
  }
  invalidateProfile()
  void track('teacher_enabled')
}

/**
 * Выключить режим преподавателя — пара к becomeTeacher.
 *
 * Включить было можно одним нажатием, а выключить — никак: человек, нажавший
 * из любопытства, оставался с чужой ролью навсегда (лишняя вкладка, лишний
 * пункт меню, чужой сценарий). Учеников RPC молча не отвязывает: если они
 * есть, приходит понятный отказ с их числом.
 *
 * ⚠️ Приведение типа — RPC новее, чем сгенерированные database.types.ts.
 * После заливки схемы типы стоит перегенерировать (ARCHITECTURE §5).
 */
export async function stopTeaching(): Promise<void> {
  const { error } = await (
    supabase.rpc as unknown as (fn: string) => Promise<{ error: { message: string } | null }>
  )('stop_teaching')
  if (error) throw dbError(error, 'выключить режим преподавателя')
  invalidateProfile()
}

/**
 * Занять/освободить место тарифа для ученика. Пока преподаватель не трогал
 * выбор, места держат первые N по дате привязки; первое явное действие
 * фиксирует текущий расклад, дальше решает выбор.
 */
export async function setStudentSeat(studentId: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_student_seat', {
    p_student: studentId,
    p_on: on,
  })
  // RECALL_SEATS_FULL и RECALL_NOT_YOUR_STUDENT переводит сам dbError:
  // тексты общие для преподавателя, дублировать их здесь незачем
  if (error) throw dbError(error, 'изменить место по тарифу')
}

/** Отвязать ученика от себя. Его аккаунт и прогресс остаются при нём. */
export async function unlinkStudent(studentId: string): Promise<void> {
  const teacherId = await requireUserId()
  const { error } = await supabase
    .from('teacher_students')
    .delete()
    .eq('teacher_id', teacherId)
    .eq('student_id', studentId)
  if (error) throw dbError(error, 'отвязать ученика')
}

/** Ученик вводит код → привязка. Возвращает имя преподавателя. */
export async function joinTeacher(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_teacher', {
    code: code.trim(),
  })
  if (error) {
    // Места кончились. Текст адресован УЧЕНИКУ и намеренно не говорит, какой у
    // преподавателя тариф: чужой тариф — не его дело (тот же принцип, что и
    // закрытые гранты на profiles).
    if (error.message.includes('RECALL_SEATS_FULL')) {
      console.error('[db] join_teacher: мест нет', error)
      throw new Error(
        'У преподавателя сейчас нет свободного места для нового ученика. Напиши ему — он освободит место или расширит тариф, и код заработает.',
      )
    }
    throw dbError(error, 'привязаться к преподавателю')
  }
  void track('student_linked')
  return (data as string) ?? 'Преподаватель'
}

/** Преподаватели текущего ученика (обычно один). */
export async function getMyTeachers(): Promise<Profile[]> {
  const userId = await requireUserId()
  const { data: links, error } = await supabase
    .from('teacher_students')
    .select('teacher_id')
    .eq('student_id', userId)
  if (error) throw error
  const ids = (links ?? []).map((l) => l.teacher_id as string)
  if (ids.length === 0) return []

  // selectProfiles: переживает отставание базы от кода (см. lib/profile)
  const { data: profiles, error: pErr } = await selectProfiles<Profile[]>((cols) =>
    supabase.from('profiles').select(cols).in('id', ids) as never,
  )
  if (pErr) throw pErr
  return (profiles ?? []) as Profile[]
}

/** Все колоды текущего пользователя (для назначения ученикам). */
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

/** Ученики текущего преподавателя со сводкой прогресса. */
export async function getMyStudents(): Promise<StudentInfo[]> {
  const userId = await requireUserId()

  // порядок привязки важен: тариф покрывает первых N учеников по дате
  // (covering_teacher в БД считает так же), и экран должен показывать то же самое
  const { data: links, error } = await supabase
    .from('teacher_students')
    .select('student_id, created_at, seat')
    .eq('teacher_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  const ids = (links ?? []).map((l) => l.student_id as string)
  if (ids.length === 0) return []
  const seatById = new Map(
    (links ?? []).map((l) => [l.student_id as string, (l as { seat?: boolean }).seat === true]),
  )

  const [profilesRes, activityRes, assignRes] = await Promise.all([
    selectProfiles<Profile[]>((cols) => supabase.from('profiles').select(cols).in('id', ids) as never),
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

  // .in() возвращает строки в произвольном порядке — восстанавливаем порядок
  // привязки, иначе «первые N покрыты тарифом» на экране будут не те люди
  const byId = new Map((profilesRes.data ?? []).map((p) => [(p as Profile).id, p as Profile]))
  const ordered = ids.map((id) => byId.get(id)).filter((p): p is Profile => !!p)

  return ordered.map((profile) => {
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
      seat: seatById.get(profile.id) === true,
    }
  })
}

/** Слова набора (для просмотра перед назначением — раньше назначали вслепую). */
export async function listDeckCards(deckId: string): Promise<Card[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('deck_id', deckId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Card[]
}

/**
 * Назначить ученику ВЫБОРКУ слов из набора: колода-копия + карточки +
 * назначение — ОДНОЙ транзакцией (RPC assign_selected_words): раньше сбой на
 * середине оставлял колоду-сироту, а ретраи плодили дубликаты (ревью
 * 2026-07-24). Возвращает число скопированных карточек.
 */
export async function assignSelectedWords(
  sourceDeck: Deck,
  studentId: string,
  studentName: string,
  cards: Card[],
): Promise<number> {
  if (cards.length === 0) return 0
  const title = `${sourceDeck.title} — выборка для ${studentName}`
  const { data, error } = await supabase.rpc('assign_selected_words', {
    p_student_id: studentId,
    p_title: title,
    p_lang: sourceDeck.lang ?? 'en',
    p_cards: cards.map((c) => ({
      front: c.front,
      back: c.back ?? '',
      example: c.example ?? '',
    })),
  })
  if (error) throw dbError(error, 'назначить слова ученику')
  return (data as number) ?? cards.length
}

/** Назначить колоду ученику. */
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
