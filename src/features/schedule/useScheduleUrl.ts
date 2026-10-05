// ============================================================================
// Адрес расписания = «где я» (PLAN.md Ф2.7): вид, день, таблица или список,
// открытый урок. ?view=day|week&day=2026-10-15&layout=cols|list&lesson=<id>
//
// Почему не useUrlState на каждый параметр: нажатие на день недели меняет
// сразу два (вид и день), а два отдельных вызова в одном нажатии затирают
// друг друга — каждый строит адрес из того, что было до нажатия.
//
// Листание дней и смена вида — заменой записи: иначе «назад» прошёл бы
// по каждому пролистанному дню. Открытый урок — новой записью: «назад» и
// свайп в PWA закрывают шторку, а не уводят с экрана.
// Без ?view — по ширине: на телефоне день, на компьютере неделя (журнал п.46).
// Без ?layout — тоже по ширине: на телефоне список, на компьютере таблица; и
// день, и неделю можно смотреть обоими (правка владельца 05.10.2026, Ф2.10).
// ============================================================================
import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export type ScheduleView = 'day' | 'week'
/**
 * Таблица (cols: день — лента часов, неделя — колонки по часам) или список
 * (день — уроки строками, неделя — по дням, макеты t1-1, t2-2).
 */
export type ScheduleLayout = 'cols' | 'list'

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function useScheduleUrl(today: string, desktop: boolean) {
  const [params, setParams] = useSearchParams()

  const rawView = params.get('view')
  const view: ScheduleView = rawView === 'day' || rawView === 'week' ? rawView : desktop ? 'week' : 'day'
  const rawDay = params.get('day')
  const day = rawDay && DAY.test(rawDay) && !Number.isNaN(Date.parse(rawDay)) ? rawDay : today
  const rawLayout = params.get('layout')
  const layout: ScheduleLayout = rawLayout === 'cols' || rawLayout === 'list' ? rawLayout : desktop ? 'cols' : 'list'
  const lessonId = params.get('lesson')

  const patch = useCallback(
    (next: Record<string, string | null>, push = false) => {
      const p = new URLSearchParams(params)
      for (const [k, v] of Object.entries(next)) {
        if (v === null) p.delete(k)
        else p.set(k, v)
      }
      setParams(p, { replace: !push })
    },
    [params, setParams],
  )

  return {
    view,
    day,
    layout,
    lessonId,
    /** Сегодня — без ?day: ссылка «на сегодня» остаётся верной и завтра. */
    goTo: (d: string, v: ScheduleView = view) => patch({ day: d === today ? null : d, view: v }),
    setView: (v: ScheduleView) => patch({ view: v }),
    setLayout: (l: ScheduleLayout) => patch({ layout: l }),
    openLesson: (id: string) => patch({ lesson: id }, true),
    closeLesson: () => patch({ lesson: null }),
  }
}
