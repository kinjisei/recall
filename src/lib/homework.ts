// ============================================================================
// Домашка на неделю — один объект вместо четырёх раздельных назначений.
//
// До этого преподаватель выдавал слова, материалы, квесты и письменные работы
// в разных разделах, и вопрос «сделал ли ученик домашнее» не имел ответа: у
// каждого источника была своя правда, а общей не было ни у кого.
//
// ⚠️ Всё считает сервер. Клиент НЕ решает, выполнен ли пункт: он показывает то,
// что вернула get_homework. Прогресс, автозачёт и проверка «твой ли это ученик»
// живут в базе — прямая запись в homework/homework_items отозвана у всех.
//
// ⚠️ Пометка «кто засчитал» — не украшение. Пункт, закрытый сервером по факту
// действия, и пункт, отмеченный галочкой, значат разное, и преподаватель обязан
// видеть разницу: иначе он планирует урок по цифре, которую ученик поставил сам.
//
// ⚠️ И честная граница: «засчитано по занятиям» — не «проверено». Расписание
// повторений и счётчики активности пишет сам ученик (известный остаток
// архитектуры), так что упорный может надуть и их. В подписях на экране
// обещаем ровно то, что есть, — иначе однажды репетитор поймает ученика на
// липе и перестанет верить всему экрану, а не одной цифре.
// ============================================================================
import { supabase } from './supabase'
import type { AppLang } from '../types'

/** Чем закрывается пункт. 'free' — единственный, который сервер измерить не может. */
export type HomeworkKind = 'words' | 'text' | 'quest' | 'writing' | 'speech' | 'free'

export interface HomeworkItem {
  id: string
  kind: HomeworkKind
  ref_id: string | null
  title: string
  target: number
  /** Сколько уже сделано — считает сервер, клиент только показывает. */
  progress: number
  done_at: string | null
  done_by: 'server' | 'student' | null
}

export interface Homework {
  id: string
  lang: AppLang
  due_at: string
  note: string | null
  created_at: string
  items: HomeworkItem[]
}

/** Что кладём в домашку при выдаче. */
export interface NewHomeworkItem {
  kind: HomeworkKind
  title: string
  target?: number
  ref_id?: string | null
}

export const KIND_LABEL: Record<HomeworkKind, string> = {
  words: 'Слова',
  text: 'Чтение',
  quest: 'Квест',
  writing: 'Письмо',
  speech: 'Речь',
  free: 'Своими словами',
}

/**
 * Пункты, выполнение которых видит сервер. Для остальных показываем ученику
 * галочку — и честно подписываем, что это его слово, а не измерение.
 */
export const MEASURED_KINDS: HomeworkKind[] = ['words', 'text', 'quest', 'writing', 'speech']
export const isMeasured = (kind: HomeworkKind): boolean => MEASURED_KINDS.includes(kind)

/**
 * Домашка ученика. Без аргумента — своя (зовёт ученик), с id — конкретного
 * ученика (зовёт преподаватель; чужого сервер не отдаст).
 */
export async function getHomework(studentId?: string): Promise<Homework | null> {
  const { data, error } = await supabase.rpc('get_homework', {
    p_student: studentId ?? undefined,
  })
  if (error) throw error
  return (data as unknown as Homework | null) ?? null
}

/** Выдать домашку. Возвращает id — пригодится для перехода к ней сразу после. */
export async function createHomework(params: {
  studentId: string
  lang: AppLang
  due: Date
  items: NewHomeworkItem[]
  note?: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_homework', {
    p_student_id: params.studentId,
    p_lang: params.lang,
    p_due: params.due.toISOString(),
    p_items: params.items.map((i) => ({
      kind: i.kind,
      title: i.title,
      target: i.target ?? 1,
      ref_id: i.ref_id ?? null,
    })),
    p_note: params.note ?? null,
  })
  if (error) throw error
  return data as unknown as string
}

/** Галочка ученика. Сервер примет её только для своего пункта. */
export async function completeItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('complete_homework_item', { p_item: itemId })
  if (error) throw error
}

/** «3 из 5» — одна цифра на оба экрана, чтобы они не разошлись. */
export function homeworkProgress(hw: Homework | null): { done: number; total: number } {
  if (!hw) return { done: 0, total: 0 }
  return { done: hw.items.filter((i) => i.done_at).length, total: hw.items.length }
}

/**
 * Срок человеческим языком. Просрочку называем прямо: «просрочена» честнее,
 * чем «осталось −2 дня», и заметнее, чем серая дата.
 */
export function dueLabel(dueAt: string): string {
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return days === -1 ? 'просрочена на день' : `просрочена на ${Math.abs(days)} дн.`
  if (days === 0) return 'сегодня'
  if (days === 1) return 'до завтра'
  return `осталось ${days} дн.`
}

/** Просрочена ли — нужно и списку учеников, и карточке. Правило одно. */
export function isOverdue(hw: Homework | null): boolean {
  if (!hw) return false
  const { done, total } = homeworkProgress(hw)
  return done < total && new Date(hw.due_at).getTime() < Date.now()
}
