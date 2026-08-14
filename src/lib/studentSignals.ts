// ============================================================================
// Что показывает строка ученика и в каком порядке идут строки.
//
// Зачем отдельный файл. Список учеников и открытая карточка показывают ОДНИ И
// ТЕ ЖЕ числа: «3 из 5» в строке обязано совпасть с «3 из 5» в карточке, а
// «занимался 5 дней из 7» — с плашкой. Пока каждое место считало само, они
// расходились не сразу и не заметно, а разойдясь — обесценивали друг друга:
// преподаватель перестаёт верить не тому числу, которое ошиблось, а экрану.
//
// Поэтому счёт домашки берётся из homeworkProgress (то же, что в карточке и у
// ученика), а дни занятий — из activityDays. Здесь только СБОРКА подписей и
// порядок, никакой своей арифметики.
// ============================================================================
import { activeDaysIn, REGULARITY_WINDOW, regularityLabel } from './activityDays.ts'
import { dueShort, homeworkProgress, isOverdue, type Homework } from './homeworkView.ts'
import type { StudentInfo } from './teacher'

/** Насколько срочно нужен преподаватель. Меньше — раньше в списке. */
export type Attention = 'overdue' | 'lost' | 'idle' | 'started' | 'ok'

export interface StudentSignal {
  /** «3 из 5», «не начал», «сделано» — null, если домашки нет. */
  homeworkText: string | null
  /** «до вторника» / «просрочена» — null, если домашки нет. */
  dueText: string | null
  /** Домашка есть, срок вышел, сделано не всё. */
  overdue: boolean
  /** Ни одного пункта не тронуто. */
  notStarted: boolean
  /** Дней с занятиями за неделю. */
  activeDays: number
  /** «5 из 7». */
  regularity: string
  /** Неделя без занятий или ни одного занятия вообще. */
  lost: boolean
  attention: Attention
}

/** Порядок важности: чем меньше индекс, тем выше в списке. */
const ORDER: Attention[] = ['overdue', 'lost', 'idle', 'started', 'ok']

/**
 * Пропал ли ученик. Правило одно на список и на сводку сверху: неделя без
 * занятий или ни одного занятия вообще.
 */
export function isLost(s: StudentInfo): boolean {
  return s.daysSinceActive === null || s.daysSinceActive >= REGULARITY_WINDOW
}

export function studentSignal(s: StudentInfo, hw: Homework | null): StudentSignal {
  const activeDays = s.activeDays7
  const lost = isLost(s)

  if (!hw) {
    return {
      homeworkText: null,
      dueText: null,
      overdue: false,
      notStarted: false,
      activeDays,
      regularity: regularityLabel(activeDays),
      lost,
      // Домашки нет — судить не о чем, кроме того, ходит ли человек вообще.
      attention: lost ? 'lost' : 'ok',
    }
  }

  const { done, total } = homeworkProgress(hw)
  const overdue = isOverdue(hw)
  const notStarted = done === 0
  const complete = total > 0 && done >= total

  return {
    homeworkText: complete ? 'домашка сделана' : notStarted ? 'не начал' : `${done} из ${total}`,
    dueText: dueShort(hw.due_at),
    overdue,
    notStarted,
    activeDays,
    regularity: regularityLabel(activeDays),
    lost,
    attention: overdue
      ? 'overdue'
      : lost
        ? 'lost'
        : complete
          ? 'ok'
          : notStarted
            ? 'idle'
            : 'started',
  }
}

/**
 * Сортировка «сперва те, кому нужно внимание».
 *
 * ⚠️ Внутри одной группы порядок ИСХОДНЫЙ (по дате привязки). Это не
 * косметика: список без устойчивого порядка перескакивает между открытиями, и
 * преподаватель каждый раз заново ищет глазами того, кого только что смотрел.
 */
export function byAttention<T>(
  items: T[],
  signalOf: (item: T) => StudentSignal,
): T[] {
  return items
    .map((item, index) => ({ item, index, rank: ORDER.indexOf(signalOf(item).attention) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.item)
}

/** Сколько учеников ждут внимания — для подписи над списком. */
export function needAttention(signals: StudentSignal[]): number {
  return signals.filter((s) => s.attention === 'overdue' || s.attention === 'lost').length
}

export { activeDaysIn, REGULARITY_WINDOW }
