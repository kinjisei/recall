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

// Типы, счёт и подписи — в homeworkView (без обращений к базе, чтобы их можно
// было проверять тестом). Здесь только запросы.
export * from './homeworkView'
import type { Homework, NewHomeworkItem } from './homeworkView'

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
      pick_group: i.pickGroup ?? null,
    })),
    p_note: params.note ?? null,
  })
  if (error) throw error
  return data as unknown as string
}

/**
 * Домашки ВСЕХ своих учеников одним запросом — для списка у преподавателя.
 *
 * ⚠️ Возвращает те же объекты, что и getHomework: сервер строит их одним
 * homework_json. Считать «3 из 5» для списка отдельно нельзя — счёт живёт в
 * homeworkProgress, и только так строка списка и открытая карточка показывают
 * одно и то же число. Разойдись они — преподаватель перестанет верить обоим.
 */
export async function getHomeworkMany(): Promise<Map<string, Homework | null>> {
  const { data, error } = await supabase.rpc('get_homework_many')
  if (error) throw error
  const out = new Map<string, Homework | null>()
  for (const [id, hw] of Object.entries((data ?? {}) as Record<string, Homework | null>)) {
    out.set(id, hw)
  }
  return out
}

/** Галочка ученика. Сервер примет её только для своего пункта. */
export async function completeItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('complete_homework_item', { p_item: itemId })
  if (error) throw error
}

/** Ученик выбирает один из альтернативных пунктов. */
export async function chooseItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('choose_homework_item', { p_item: itemId })
  if (error) throw error
}

