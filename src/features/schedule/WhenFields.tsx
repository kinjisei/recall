// ============================================================================
// «Дата и время» шторок «Новый урок», «Изменить» и «Перенести» (макеты t3, t5):
// два поля-кнопки, под ними — календарь месяца или колёса часов и минут (по
// одному сразу), ниже — «Пересекается с «IELTS вечер» 17:00–18:30».
// Длительность (1 ч · 1,5 ч · 2 ч · Своя) — отдельно, в DurationField.
// ============================================================================
import { useState } from 'react'
import { addDays } from '../../shared/lib/days'
import {
  DURATIONS,
  durationLabel,
  endTime,
  lessonName,
  MINUTES_MAX,
  MINUTES_MIN,
  timeRange,
  dayShort,
  type Lesson,
} from '../../domains/schedule'
import { ChoiceGroup } from '../../shared/ui/ChoiceGroup'
import { DatePicker } from '../../shared/ui/DatePicker'
import { FieldButton } from '../../shared/ui/FieldButton'
import { IconCalendar, IconClock, IconInfo, IconWarning } from '../../shared/ui/icons'
import { TimeWheel } from '../../shared/ui/TimeWheel'

export function WhenFields({
  day,
  time,
  minutes,
  today,
  showDate = true,
  clashes,
  onDay,
  onTime,
}: {
  day: string
  time: string
  minutes: number
  today: string
  /** «Этот и все следующие» — дни задаёт повтор, даты нет. */
  showDate?: boolean
  /** Уроки, с которыми пересекается. */
  clashes: Lesson[]
  onDay: (day: string) => void
  onTime: (time: string) => void
}) {
  const [open, setOpen] = useState<'date' | 'time' | null>(null)
  const toggle = (what: 'date' | 'time') => setOpen((o) => (o === what ? null : what))
  return (
    <div className="flex flex-col gap-2">
      <div className={`grid gap-2 ${showDate ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {showDate && (
          <FieldButton Icon={IconCalendar} label="Дата" open={open === 'date'} onClick={() => toggle('date')}>
            {dayShort(day)}
          </FieldButton>
        )}
        <FieldButton Icon={IconClock} label="Время" open={open === 'time'} onClick={() => toggle('time')}>
          <span className="tabular-nums">{time}</span>
          <span className="font-normal text-fg-muted tabular-nums">–{endTime(time, minutes)}</span>
        </FieldButton>
      </div>
      {open === 'date' && (
        <DatePicker
          value={day}
          today={today}
          soft={today}
          min={addDays(today, -60)}
          max={addDays(today, 400)}
          onChange={onDay}
          onDone={() => setOpen(null)}
          label="Дата урока"
        />
      )}
      {open === 'time' && <TimeWheel value={time} onChange={onTime} />}
      {clashes.map((l) => (
        <p key={l.id} role="status" className="flex items-center gap-1.5 text-note text-warning-strong">
          <IconWarning size={15} aria-hidden className="flex-none" />
          Пересекается с «{lessonName(l)}» {timeRange(l)}
        </p>
      ))}
    </div>
  )
}

type DurationChoice = '60' | '90' | '120' | 'own'

/** «1 ч · 1,5 ч · 2 ч · Своя» и подсказка о списании (журнал п.26, 39, 43). */
export function DurationField({ minutes, trial, onMinutes }: { minutes: number; trial: boolean; onMinutes: (m: number) => void }) {
  const preset = (DURATIONS as readonly number[]).includes(minutes)
  const [own, setOwn] = useState(!preset)
  const value: DurationChoice = own || !preset ? 'own' : (String(minutes) as DurationChoice)
  return (
    <div className="flex flex-col gap-2">
      <ChoiceGroup<DurationChoice>
        label="Длительность"
        stretch
        value={value}
        onChange={(id) => {
          setOwn(id === 'own')
          if (id !== 'own') onMinutes(Number(id))
        }}
        options={[...DURATIONS.map((m) => ({ id: String(m) as DurationChoice, label: durationLabel(m) })), { id: 'own', label: 'Своя' }]}
      />
      {value === 'own' && (
        <label className="flex items-center gap-2 text-sm text-fg-secondary">
          <input
            inputMode="numeric"
            aria-label="Длительность, минут"
            value={String(minutes)}
            onChange={(e) => onMinutes(Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 0)}
            className="min-h-11 w-24 rounded-xl bg-input px-3 text-base ring-1 ring-control-line outline-none focus:ring-2 focus:ring-accent-line"
          />
          минут · {durationLabel(Math.min(Math.max(minutes, MINUTES_MIN), MINUTES_MAX))}
        </label>
      )}
      {/* у обычного урока подписи нет: «списывается 1 урок» — то, что учитель
          и так знает (приёмка Ф2.11, журнал п.71) */}
      {trial && (
        <p className="flex items-center gap-1.5 text-note text-fg-muted">
          <IconInfo size={15} aria-hidden className="flex-none" />
          Пробный урок не списывается
        </p>
      )}
    </div>
  )
}
