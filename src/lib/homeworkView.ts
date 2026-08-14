// ============================================================================
// Домашка: типы, счёт и подписи. БЕЗ обращений к базе.
//
// Отделено от lib/homework намеренно. Счёт «3 из 5» показывают ТРИ места —
// карточка преподавателя, список учеников и экран ученика, — и он обязан быть
// один. Чтобы его можно было проверить тестом (scripts/test-student-signals),
// модуль не должен тянуть supabase: тот читает import.meta.env и вне Vite
// просто не грузится.
// ============================================================================
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

/** Дни недели в родительном: «до вторника». */
const WEEKDAY_TO = [
  'воскресенья',
  'понедельника',
  'вторника',
  'среды',
  'четверга',
  'пятницы',
  'субботы',
]
const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]

/**
 * Короткий срок для строки списка: «до вторника».
 *
 * ⚠️ День недели, а не «осталось 3 дн.». Преподаватель планирует неделю днями
 * («созвонимся в среду»), и «до вторника» он соотносит с расписанием мгновенно,
 * а «осталось 3 дня» приходится пересчитывать. Дальше недели день недели уже
 * неоднозначен — там переходим на дату.
 */
/**
 * Прошёл ли срок. Сравниваем МОМЕНТЫ, а не округлённые дни.
 *
 * ⚠️ Здесь была ошибка, и одинаковая в обеих подписях: срок округлялся до дней
 * через Math.ceil, а Math.ceil(-0.5) даёт -0, и проверка «days < 0» его не
 * ловила. Домашка, просроченная меньше суток назад, подписывалась «сегодня» —
 * при том что isOverdue (он сравнивает моменты) уже считал её просроченной.
 * То есть строка говорила «сегодня», а порядок ставил ученика первым как
 * просрочившего: два места об одном и том же расходились.
 */
const msLeft = (dueAt: string): number => new Date(dueAt).getTime() - Date.now()

export function dueShort(dueAt: string): string {
  const ms = msLeft(dueAt)
  if (ms < 0) return 'просрочена'
  const due = new Date(dueAt)
  const days = Math.ceil(ms / 86_400_000)
  if (days === 0) return 'сегодня'
  if (days === 1) return 'до завтра'
  if (days <= 6) return `до ${WEEKDAY_TO[due.getDay()]}`
  return `до ${due.getDate()} ${MONTHS_SHORT[due.getMonth()]}`
}

/**
 * Срок человеческим языком. Просрочку называем прямо: «просрочена» честнее,
 * чем «осталось −2 дня», и заметнее, чем серая дата.
 */
export function dueLabel(dueAt: string): string {
  const ms = msLeft(dueAt)
  if (ms < 0) {
    const late = Math.floor(-ms / 86_400_000)
    if (late === 0) return 'просрочена'
    if (late === 1) return 'просрочена на день'
    return `просрочена на ${late} дн.`
  }
  const days = Math.ceil(ms / 86_400_000)
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
