// ============================================================================
// Расписание учителя — слой данных домена (архитектура §2, §4); чтение
// ученика — api.student.ts (его берёт Главная, учительское ей не нужно). Таблицы миграции 0009 закрыты всем; всё — через RPC. Права, тариф и
// списания решает база: без тарифа после пробного запись отказывает
// (RECALL_PLAN_REQUIRED, журнал п.41), чтение работает.
// ============================================================================
import type { CardStatus } from '../students'
import { supabase } from '../../shared/api/supabase'
import { dbError } from '../../shared/api/errors'
import {
  groupSchedule,
  type Charge,
  type Lesson,
  type LessonBalance,
  type LessonKind,
  type LessonStatus,
  type Outcome,
  type Series,
  type SeriesKind,
} from './model'
import type { HistoryItem } from './ledger'

/** Уроки учителя за период (не длиннее RANGE_MAX_DAYS). */
export async function loadSchedule(from: Date, to: Date): Promise<Lesson[]> {
  const { data, error } = await supabase.rpc('get_schedule', { p_from: from.toISOString(), p_to: to.toISOString() })
  if (error) throw dbError(error, 'загрузить расписание')
  return groupSchedule(
    (data ?? []).map((r) => ({
      lessonId: r.lesson_id,
      seriesId: r.series_id ?? null,
      seriesDate: r.series_date ?? null,
      kind: r.kind as LessonKind,
      status: r.status as LessonStatus,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      title: r.title ?? null,
      link: r.link ?? null,
      movedFrom: r.moved_from ?? null,
      version: r.version,
      settled: r.settled === true,
      participant: r.card_id
        ? {
            cardId: r.card_id,
            name: r.card_name,
            cardStatus: r.card_status as CardStatus,
            trial: r.trial === true,
            attended: r.attended ?? null,
            charge: (r.charge ?? null) as Charge | null,
            chargeAuto: r.charge_auto === true,
          }
        : null,
    })),
  )
}

/** Действующие серии учителя (для «этот и все следующие»). */
export async function loadMySeries(): Promise<Series[]> {
  const { data, error } = await supabase.rpc('get_my_series')
  if (error) throw dbError(error, 'загрузить расписание')
  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind as SeriesKind,
    title: r.title ?? null,
    weekdays: r.weekdays,
    startTime: r.start_time,
    minutes: r.minutes,
    everyWeeks: r.every_weeks,
    startsOn: r.starts_on,
    endsOn: r.ends_on ?? null,
    link: r.link ?? null,
    cardIds: r.card_ids ?? [],
    splitFrom: r.split_from ?? null,
  }))
}

/** Остатки уроков по всем карточкам учителя. */
export async function loadLessonBalances(): Promise<LessonBalance[]> {
  const { data, error } = await supabase.rpc('get_lesson_balances')
  if (error) throw dbError(error, 'загрузить остатки уроков')
  return (data ?? []).map((r) => ({ cardId: r.card_id, paid: r.paid, charged: r.charged, balance: r.balance }))
}

/** Ссылка на урок по умолчанию (журнал п.43); null — не задана. */
export async function loadDefaultLessonLink(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_schedule_settings')
  if (error) throw dbError(error, 'загрузить настройки расписания')
  return data?.[0]?.default_link ?? null
}

export async function saveDefaultLessonLink(link: string): Promise<void> {
  const { error } = await supabase.rpc('set_default_lesson_link', { p_link: link })
  if (error) throw dbError(error, 'сохранить ссылку')
}

export interface LessonInput {
  kind: LessonKind
  startsAt: string
  minutes: number
  cardIds: string[]
  title?: string
  link?: string
}

/** Разовый урок (в том числе пробный). Возвращает id. */
export async function createLesson(input: LessonInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_lesson', lessonArgs(input))
  if (error) throw dbError(error, 'добавить урок')
  return data
}

/** «Только этот»: перенос и правка одного урока. */
export async function updateLesson(id: string, input: LessonInput): Promise<void> {
  const { error } = await supabase.rpc('update_lesson', { p_lesson: id, ...lessonArgs(input) })
  if (error) throw dbError(error, 'сохранить урок')
}

const lessonArgs = (i: LessonInput) => ({
  p_kind: i.kind,
  p_starts_at: i.startsAt,
  p_minutes: i.minutes,
  p_cards: i.cardIds,
  p_title: i.title,
  p_link: i.link,
})

export interface SeriesInput {
  kind: SeriesKind
  /** ISO: 1 — понедельник … 7 — воскресенье. */
  weekdays: number[]
  /** «19:00» по Алматы. */
  time: string
  minutes: number
  everyWeeks: 1 | 2
  /** null — без даты окончания. */
  endsOn: string | null
  cardIds: string[]
  title?: string
  link?: string
}

const seriesArgs = (i: SeriesInput) => ({
  p_kind: i.kind,
  p_weekdays: i.weekdays,
  p_time: i.time,
  p_minutes: i.minutes,
  p_every_weeks: i.everyWeeks,
  p_ends_on: i.endsOn ?? undefined,
  p_cards: i.cardIds,
  p_title: i.title,
  p_link: i.link,
})

/** Серия «каждый вт и чт в 19:00» с даты startsOn. Возвращает id серии. */
export async function createSeries(input: SeriesInput & { startsOn: string }): Promise<string> {
  const { data, error } = await supabase.rpc('create_series', { ...seriesArgs(input), p_starts_on: input.startsOn })
  if (error) throw dbError(error, 'добавить уроки')
  return data
}

/** «Этот и все следующие»: делит серию на дне урока. Возвращает id новой серии. */
export async function updateSeriesFrom(lessonId: string, input: SeriesInput): Promise<string> {
  const { data, error } = await supabase.rpc('update_series_from', { p_lesson: lessonId, ...seriesArgs(input) })
  if (error) throw dbError(error, 'изменить уроки')
  return data
}

/** Отмена одного урока: charge — «списать — поздняя отмена» (журнал п.27). */
export async function cancelLesson(id: string, charge: boolean): Promise<void> {
  const { error } = await supabase.rpc('cancel_lesson', { p_lesson: id, p_charge: charge })
  if (error) throw dbError(error, 'отменить урок')
}

/** Отмена урока и всех следующих в серии. */
export async function cancelSeriesFrom(id: string, charge: boolean): Promise<void> {
  const { error } = await supabase.rpc('cancel_series_from', { p_lesson: id, p_charge: charge })
  if (error) throw dbError(error, 'отменить уроки')
}

/** Вернуть отменённый урок. */
export async function restoreLesson(id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_lesson', { p_lesson: id })
  if (error) throw dbError(error, 'вернуть урок')
}

/** Отметка участника; исправление задним числом — тот же вызов. */
export async function markParticipant(lessonId: string, cardId: string, outcome: Outcome): Promise<void> {
  const { error } = await supabase.rpc('mark_lesson_participant', { p_lesson: lessonId, p_card: cardId, p_outcome: outcome })
  if (error) throw dbError(error, 'отметить урок')
}

/** Оплата «+N» уроков (журнал п.29); минус — исправление. paidOn — день оплаты, по умолчанию сегодня (п.67). */
export async function addPaidLessons(cardId: string, count: number, note?: string, paidOn?: string): Promise<void> {
  const { error } = await supabase.rpc('add_paid_lessons', { p_card: cardId, p_count: count, p_note: note, p_paid_on: paidOn })
  if (error) throw dbError(error, 'отметить оплату')
}

/** История карточки (макет t7-2): оплаты и уроки, новые сверху; before — следующая страница. */
export async function loadCardHistory(cardId: string, before?: string, limit = 50): Promise<HistoryItem[]> {
  const { data, error } = await supabase.rpc('get_card_history', { p_card: cardId, p_before: before, p_limit: limit })
  if (error) throw dbError(error, 'загрузить историю')
  return (data ?? []).map((r) => ({
    item: r.item === 'payment' ? 'payment' : 'lesson',
    id: r.id,
    at: r.at,
    n: r.n ?? null,
    note: r.note ?? null,
    paidOn: r.paid_on ?? null,
    lessonKind: (r.lesson_kind ?? null) as LessonKind | null,
    lessonStatus: (r.lesson_status ?? null) as LessonStatus | null,
    title: r.title ?? null,
    startsAt: r.starts_at ?? null,
    trial: r.trial ?? null,
    attended: r.attended ?? null,
    charge: (r.charge ?? null) as Charge | null,
    chargeAuto: r.charge_auto ?? null,
  }))
}

/** Отменённый урок задним числом: «поздняя отмена · списан» ↔ «не списан» (t7-2). */
export async function setCancelCharge(lessonId: string, cardId: string, charge: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_cancel_charge', { p_lesson: lessonId, p_card: cardId, p_charge: charge })
  if (error) throw dbError(error, 'исправить запись')
}

/** «Напомнить → В приложении» (t7-3): сообщение ученику от учителя, только по нажатию. */
export async function sendCardMessage(cardId: string, text: string): Promise<void> {
  const { error } = await supabase.rpc('send_card_message', { p_card: cardId, p_text: text })
  if (error) throw dbError(error, 'отправить сообщение')
}
