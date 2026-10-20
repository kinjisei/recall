// ============================================================================
// Строки списка «Учеников» (макеты d3-1, d3-5, t6-1; PLAN.md Ф2.17-4б-1):
// вторая строка — ближайший урок, справа остаток, пробный «остаётся?»
// закреплён сверху, порядок — «Ближайший урок» или «Осталось уроков» с ↑↓
// (выбор помнится на устройстве). Сверх макета (журнал п.76 (5)) — бейдж
// домашки рядом с именем: «просрочена», «не начата». Правила урока и порядка
// — domains/schedule (roster) и domains/students (sortRoster).
// ============================================================================
import { useState } from 'react'
import {
  balanceShort,
  groupLessonPath,
  groupLine,
  lessonLine,
  nextLessonOf,
  studioGroups,
  trialQuestions,
  type Lesson,
  type LessonBalance,
  type Series,
} from '../../domains/schedule'
import { outsideSeats, ROSTER_SORTS, sortRoster, type RosterSort, type StudentCard } from '../../domains/students'
import { readJson, writeJson } from '../../shared/lib/storage'
import { BalanceCount } from '../schedule'
import type { RosterGroup, RosterRow } from '../students'
import type { StudentSignal } from '../../lib/studentSignals'

const SORT_KEY = 'recall.students.sort'

/** Порядок списка и его направление — на устройстве, как выбрал учитель. */
export function useRosterSort() {
  const [state, setState] = useState<{ by: RosterSort; desc: boolean }>(() => {
    const saved = readJson<{ by?: string; desc?: boolean }>(SORT_KEY, {})
    const by = ROSTER_SORTS.some((s) => s.id === saved.by) ? (saved.by as RosterSort) : 'next'
    return { by, desc: saved.desc === true }
  })
  const save = (next: { by: RosterSort; desc: boolean }) => {
    setState(next)
    writeJson(SORT_KEY, next)
  }
  return {
    ...state,
    onBy: (by: RosterSort) => save({ by, desc: state.by === by ? state.desc : false }),
    onFlip: () => save({ ...state, desc: !state.desc }),
  }
}

/** Бейдж домашки рядом с именем: только то, с чем стоит что-то сделать. */
function homeworkMark(card: StudentCard, signal: StudentSignal | null): string | null {
  if (!signal || (card.status !== 'active' && card.status !== 'trial')) return null
  if (signal.overdue) return 'просрочена'
  if (signal.notStarted && signal.homeworkText) return 'не начата'
  return null
}

/**
 * Строки в порядке показа. `lessons` — null, пока уроки не пришли или не
 * загрузились: тогда во второй строке пусто, а не «уроков нет» (Ф1.13), и
 * порядок «Ближайший урок» — по имени.
 */
export function rosterRows({
  cards,
  signals,
  balances,
  lessons,
  sort,
  seatsLimited,
  canWrite,
  now,
}: {
  cards: StudentCard[]
  signals: Map<string, StudentSignal | null>
  balances: Map<string, LessonBalance>
  lessons: Lesson[] | null
  sort: { by: RosterSort; desc: boolean }
  seatsLimited: boolean
  canWrite: boolean
  now: Date
}): RosterRow[] {
  // пробный прошёл — «остаётся?» решает учитель, в расписании (t7, Ф2.8)
  const asks = new Set(canWrite && lessons ? trialQuestions(lessons, now).map((q) => q.participant.cardId) : [])
  const items = cards.map((card) => {
    const next = lessons ? nextLessonOf(lessons, card.id, now) : null
    const balance = balances.get(card.id)
    const trialAsk = asks.has(card.id)
    const row: RosterRow = {
      card,
      line: trialAsk ? 'Пробный прошёл — остаётся?' : lessons ? lessonLine(next, now) : ' ',
      trialAsk,
      mark: homeworkMark(card, signals.get(card.id) ?? null),
      trailing: balanceShort(balance) ? <BalanceCount balance={balance} /> : null,
      outside: outsideSeats(card, seatsLimited),
    }
    return { row, next: next ? Date.parse(next.startsAt) : null, left: balanceShort(balance) ? (balance?.balance ?? null) : null }
  })
  return sortRoster(items, {
    key: (x) => (sort.by === 'next' ? x.next : x.left),
    desc: sort.desc,
    pinned: (x) => x.row.trialAsk,
    name: (x) => x.row.card.name,
  }).map((x) => x.row)
}

/** Раздел «Группы»: групповые серии с ближайшим уроком; нажал — урок в расписании. */
export function rosterGroups(series: Series[] | null, lessons: Lesson[] | null, now: Date): RosterGroup[] {
  if (!series || !lessons) return []
  return studioGroups(series, lessons, now).map((g) => ({ id: g.seriesId, title: g.title, line: groupLine(g, now), to: groupLessonPath(g) }))
}
