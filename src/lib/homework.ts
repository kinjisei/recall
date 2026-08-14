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
  /** Пункты с одним номером — альтернативы: ученик делает ОДИН из них. */
  pick_group: number | null
  /** Когда ученик выбрал этот вариант (нажал сам или просто сделал). */
  chosen_at: string | null
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
  /** Одинаковый номер = альтернативы «на выбор». Группа из одного пункта
   *  распускается сервером: выбор из одного варианта — не выбор. */
  pickGroup?: number
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
      pick_group: i.pickGroup ?? null,
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

/** Ученик выбирает один из альтернативных пунктов. */
export async function chooseItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('choose_homework_item', { p_item: itemId })
  if (error) throw error
}

/**
 * Пункты, сгруппированные для показа и счёта: обычный пункт идёт один, а
 * альтернативы — вместе, как ОДНА строка выбора.
 *
 * ⚠️ Группировка живёт здесь, а не на экранах. Их два (карточка преподавателя и
 * список ученика), и разойдись они — один показал бы «3 из 5», другой «3 из 6»
 * по одной и той же домашке.
 */
export interface HomeworkRow {
  /** Один пункт, либо альтернативы одной группы. */
  items: HomeworkItem[]
  pickGroup: number | null
  /** Выбранный вариант (или единственный пункт). */
  chosen: HomeworkItem | null
  done: boolean
}

export function homeworkRows(hw: Homework | null): HomeworkRow[] {
  if (!hw) return []
  const rows: HomeworkRow[] = []
  const byGroup = new Map<number, HomeworkRow>()
  for (const item of hw.items) {
    if (item.pick_group == null) {
      rows.push({ items: [item], pickGroup: null, chosen: item, done: !!item.done_at })
      continue
    }
    let row = byGroup.get(item.pick_group)
    if (!row) {
      row = { items: [], pickGroup: item.pick_group, chosen: null, done: false }
      byGroup.set(item.pick_group, row)
      rows.push(row)
    }
    row.items.push(item)
    // ⚠️ Сделанное важнее заявленного, и порядок проверок здесь имеет значение.
    // Если пункт группы уже закрыт, он и есть выбор — заявка на другой вариант
    // его не перебивает. Сервер такую заявку и не примет (RECALL_CHOICE_DONE),
    // но экран обязан быть верным и на данных, пришедших из прошлого состояния:
    // иначе строка показывала бы «квест · выбрал ученик» с галочкой, хотя
    // выполнена была речь.
    if (item.done_at) {
      row.done = true
      row.chosen = item
    } else if (item.chosen_at && !row.done) {
      row.chosen = item
    }
  }
  return rows
}

/** «3 из 5» — одна цифра на оба экрана. Группа «на выбор» считается за один. */
export function homeworkProgress(hw: Homework | null): { done: number; total: number } {
  const rows = homeworkRows(hw)
  return { done: rows.filter((r) => r.done).length, total: rows.length }
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
