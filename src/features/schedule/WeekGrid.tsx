// ============================================================================
// Неделя колонками по часам (макеты d1 и t2-2 «колонки»). На компьютере — вид
// по умолчанию (журнал п.46), как в d1: шапка дня «пн, 12 · 2 урока» слева,
// сегодня — мягким акцентом, колонка сегодня подкрашена; час 46 px (в d1 —
// 40, урок на час ≥ 44 — цель для мыши, ux-audit), часы 8–21 — вся неделя в
// окне 800; линия «сейчас» с точкой и временем у шкалы; наведение на пустое
// время — «+ 11:00 N»: нажатие или N — «Новый урок» на это время (d1-2).
// На телефоне — мини-сетка: у урока только час начала, под сеткой — что
// значит какой вид. Шапка дня открывает этот день; урок — его шторку.
// ============================================================================
import type { MouseEvent } from 'react'
import { addDays, formatTime } from '../../shared/lib/days'
import {
  almatyMinutes,
  almatyTime,
  hourWindow,
  lessonsCount,
  placeLessons,
  WEEKDAY_NAMES,
  type Lesson,
} from '../../domains/schedule'
import { IconPlus } from '../../shared/ui/icons'
import { Kbd } from '../../shared/ui/Kbd'
import { LessonBlock } from './LessonBlock'
import { LESSON_LOOK, type LookKind } from './LessonParts'

const LEGEND: { label: string; kind: LookKind }[] = [
  { label: 'Ученик', kind: 'one' },
  { label: 'Группа', kind: 'group' },
  { label: 'Пробный', kind: 'trial' },
  { label: 'Отменён', kind: 'cancelled' },
  { label: 'Поздняя отмена', kind: 'late' },
]

export interface WeekSlot {
  /** Время под мышью: «+ 11:00» на этом дне. */
  at: { day: string; time: string } | null
  onHover: (at: { day: string; time: string } | null) => void
  onPick: (at: { day: string; time: string }) => void
}

export function WeekGrid({
  monday,
  today,
  days: byDay,
  now,
  compact,
  nextId,
  inApp,
  onOpen,
  onDay,
  slot,
}: {
  monday: string
  today: string
  /** Уроки по дням (по Алматы). */
  days: Map<string, Lesson[]>
  now: Date
  /** Телефон: мини-сетка. */
  compact: boolean
  /** Ближайший урок — в кольце (d1). */
  nextId: string | null
  inApp: (cardId: string) => boolean
  onOpen: (id: string) => void
  onDay: (day: string) => void
  /** Компьютер с правом записи: новый урок с пустого времени. */
  slot: WeekSlot | null
}) {
  const week = WEEKDAY_NAMES.map((name, i) => ({ name, day: addDays(monday, i) }))
  const placed = week.map(({ day }) => placeLessons(byDay.get(day) ?? [], day))
  const { from, to } = hourWindow(placed.flat(), compact ? 22 : 21)
  // компьютер: час 46 px — урок на час 44 (цель для мыши и тачпада, ux-audit);
  // телефон: мини-сетка, нажимается день целиком
  const hourPx = compact ? 36 : 46
  const y = (minutes: number) => ((minutes - from * 60) * hourPx) / 60
  const height = y(to * 60)
  const hours = Array.from({ length: to - from }, (_, i) => from + i)
  const nowMin = almatyMinutes(now)
  const nowShown = nowMin >= from * 60 && nowMin <= to * 60
  const columns = { gridTemplateColumns: `${compact ? '1.75rem' : '3rem'} repeat(7, minmax(0, 1fr))` }

  // время под мышью — с шагом 30 минут, урок на час помещается до конца сетки
  const hover = (day: string) => (e: MouseEvent<HTMLOListElement>) => {
    if (!slot) return
    if ((e.target as HTMLElement).closest('[data-week-lesson]')) return slot.onHover(null)
    const rect = e.currentTarget.getBoundingClientRect()
    const min = Math.floor((from * 60 + ((e.clientY - rect.top) / hourPx) * 60) / 30) * 30
    const at = Math.max(from * 60, Math.min(min, to * 60 - 60))
    const time = formatTime(Math.floor(at / 60), at % 60)
    if (slot.at?.day !== day || slot.at.time !== time) slot.onHover({ day, time })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`overflow-hidden rounded-row bg-surface shadow-card ${compact ? 'border border-tint/[0.08]' : ''}`}>
        <div className={`grid ${compact ? 'border-b border-tint/[0.08]' : 'pt-1'}`} style={columns}>
          <span />
          {week.map(({ name, day }, i) => {
            const n = (byDay.get(day) ?? []).filter((l) => l.status !== 'cancelled').length
            const isToday = day === today
            return (
              <button
                key={day}
                type="button"
                onClick={() => onDay(day)}
                aria-label={`${name}, ${Number(day.slice(8))}: ${n ? lessonsCount(n) : 'нет уроков'}. Открыть день`}
                className={
                  compact
                    ? `flex min-h-11 flex-col items-center justify-center px-1 py-1.5 hover:bg-tint/[0.04] ${isToday ? 'bg-accent-soft text-accent-soft-fg' : ''} ${
                        i > 0 ? 'border-l border-tint/[0.06]' : ''
                      }`
                    : `mx-0.5 flex min-h-12 min-w-0 flex-col items-start justify-center rounded-t-tile px-2.5 text-left ${
                        isToday ? 'bg-accent-soft text-accent-soft-fg' : 'text-fg hover:bg-tint/[0.04]'
                      }`
                }
              >
                {compact ? (
                  <>
                    <span className={`text-caption ${isToday ? 'font-semibold' : 'text-fg-muted'}`}>{name}</span>
                    <span className="text-sm font-bold tabular-nums">{Number(day.slice(8))}</span>
                    <span className={`text-caption ${isToday ? '' : 'text-fg-muted'}`}>{n || '–'}</span>
                  </>
                ) : (
                  <>
                    <span className="max-w-full truncate text-body font-semibold tabular-nums">{`${name}, ${Number(day.slice(8))}`}</span>
                    <span className={`max-w-full truncate text-xs ${isToday ? '' : 'text-fg-muted'}`}>
                      {n ? lessonsCount(n) : 'нет уроков'}
                      {isToday && ' · сегодня'}
                    </span>
                  </>
                )}
              </button>
            )
          })}
        </div>

        {/* отступ сверху — подписи часов стоят по центру линии, первая не срезается */}
        <div className={`relative grid pt-2 ${compact ? '' : 'border-t border-line'}`} style={{ ...columns, height: height + 8 }}>
          <div aria-hidden className="relative">
            {hours.map((h) => (
              <span key={h} className="absolute right-1 -translate-y-1/2 text-caption tabular-nums text-fg-muted" style={{ top: y(h * 60) }}>
                {compact ? String(h % 24).padStart(2, '0') : formatTime(h)}
              </span>
            ))}
            {/* «сейчас» у шкалы — плашкой цвета главной кнопки (d1) */}
            {!compact && nowShown && week.some(({ day }) => day === today) && (
              <span
                className="absolute left-1 flex h-5 -translate-y-1/2 items-center rounded-full bg-primary px-1.5 text-caption font-bold tabular-nums text-primary-fg"
                style={{ top: y(nowMin) }}
              >
                {almatyTime(now.toISOString())}
              </span>
            )}
          </div>
          {week.map(({ day }, i) => (
            <ol
              key={day}
              aria-label={`Уроки, ${WEEKDAY_NAMES[i]}`}
              // телефон: уроки в колонке шириной 42 px пальцем не попасть —
              // колонка целиком открывает день (подпись под сеткой, макет t2-2);
              // компьютер: пустое время — «Новый урок» на него (мышь; с клавиатуры — «Новый урок» в шапке)
              onClick={
                compact
                  ? () => onDay(day)
                  : slot
                    ? (e) => {
                        if ((e.target as HTMLElement).closest('[data-week-lesson]') || slot.at?.day !== day) return
                        slot.onPick(slot.at)
                      }
                    : undefined
              }
              onMouseMove={compact ? undefined : hover(day)}
              onMouseLeave={slot ? () => slot.onHover(null) : undefined}
              className={`relative border-l ${compact ? 'border-tint/[0.06]' : 'border-line'} ${
                day === today ? (compact ? 'bg-tint/[0.03]' : 'bg-tint/[0.06]') : ''
              } ${compact || slot ? 'cursor-pointer' : ''}`}
            >
              {hours.map((h) => (
                <li key={h} aria-hidden className={`absolute inset-x-0 h-px ${compact ? 'bg-tint/[0.05]' : 'bg-line'}`} style={{ top: y(h * 60) }} />
              ))}
              {slot?.at?.day === day && (
                <li
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0.5 flex items-center gap-1.5 rounded-tag bg-accent-soft px-2 text-xs font-semibold text-accent-soft-fg inset-ring-2 inset-ring-focus"
                  style={{ top: y(toMin(slot.at.time)) + 1, height: hourPx - 2 }}
                >
                  <IconPlus size={14} />
                  {slot.at.time}
                  <Kbd show="pointer" className="ml-auto">
                    N
                  </Kbd>
                </li>
              )}
              {(placed[i] ?? []).map(({ item, top, height: len, lane, lanes }) => {
                const h = Math.max(compact ? 18 : 44, y(top + len) - y(top) - 2)
                return (
                  <li
                    key={item.id}
                    data-week-lesson
                    className="absolute px-0.75"
                    style={{ top: y(top) + 1, height: h, left: `${(lane / lanes) * 100}%`, width: `${100 / lanes}%` }}
                  >
                    <LessonBlock
                      lesson={item}
                      now={now}
                      size={compact ? 'mini' : 'week'}
                      next={!compact && item.id === nextId}
                      tall={h >= 40}
                      inApp={inApp}
                      onOpen={onOpen}
                    />
                  </li>
                )
              })}
              {day === today && nowShown && (
                <li aria-hidden className="pointer-events-none absolute inset-x-0 h-0.5 bg-accent" style={{ top: y(nowMin) - 1 }}>
                  {!compact && <span className="absolute -left-1 -top-0.75 size-2 rounded-full bg-accent" />}
                </li>
              )}
            </ol>
          ))}
        </div>
      </div>

      {compact && (
        <>
          <ul aria-label="Обозначения" className="flex flex-wrap gap-x-3 gap-y-1.5 text-caption text-fg-secondary">
            {LEGEND.map((l) => (
              <li key={l.label} className="flex items-center gap-1.5">
                <span aria-hidden className={`h-3 w-4 rounded-mark ${LESSON_LOOK.mini[l.kind]}`} />
                {l.label}
              </li>
            ))}
          </ul>
          <p className="text-note text-fg-muted">Нажми на день — откроется этот день.</p>
        </>
      )}
    </div>
  )
}

const toMin = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
