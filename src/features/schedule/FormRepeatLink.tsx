// ============================================================================
// Повтор и ссылка шторки «Новый урок» (макет t3; журнал п.31, 43).
//   Повтор: «Повторять» → дни недели, «Каждую неделю / Раз в 2 недели»,
//   «Без даты / До даты». Пробный — всегда разовый.
//   Ссылка: есть ссылка по умолчанию — строка «… · Изменить»; своя ссылка —
//   только для этого урока или группы; нет по умолчанию — первая введённая
//   запоминается для следующих уроков (t3-3).
// ============================================================================
import { useState } from 'react'
import { addDays } from '../../shared/lib/days'
import { dayShort, WEEKDAY_NAMES, type LessonDraft } from '../../domains/schedule'
import { DatePicker } from '../../shared/ui/DatePicker'
import { FieldButton } from '../../shared/ui/FieldButton'
import { IconCalendar, IconLink } from '../../shared/ui/icons'
import { Switch } from '../../shared/ui/Switch'
import { TabPicker } from '../../shared/ui/TabPicker'

const label = 'text-note text-fg-muted'

export function FormRepeat({
  draft,
  today,
  fixed = false,
  onChange,
}: {
  draft: LessonDraft
  today: string
  /** «Этот и все следующие» — это серия, тумблера «Повторять» нет. */
  fixed?: boolean
  onChange: (p: Partial<LessonDraft>) => void
}) {
  const [calendar, setCalendar] = useState(false)
  const toggleDay = (w: number) =>
    onChange({ weekdays: draft.weekdays.includes(w) ? draft.weekdays.filter((x) => x !== w) : [...draft.weekdays, w].sort((a, b) => a - b) })
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-tint/[0.08] p-3">
      {fixed ? (
        <span className="text-sm font-semibold">Повтор</span>
      ) : (
        <Switch checked={draft.repeat} onChange={(repeat) => onChange({ repeat })} label="Повторять" hint={draft.repeat ? undefined : 'Не повторяется — разовый урок'} />
      )}
      {draft.repeat && (
        <>
          <div role="group" aria-label="Дни недели" className="flex flex-col gap-1.5">
            <span className={label}>Дни недели</span>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_NAMES.map((name, i) => {
                const on = draft.weekdays.includes(i + 1)
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(i + 1)}
                    className={`mx-auto flex size-11 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                      on ? 'bg-accent text-accent-fg' : 'bg-tint/[0.06] text-fg-secondary ring-1 ring-control-line'
                    }`}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Как часто</span>
            <TabPicker
              variant="segment"
              stretch
              ariaLabel="Как часто"
              value={String(draft.everyWeeks) as '1' | '2'}
              onChange={(v) => onChange({ everyWeeks: v === '2' ? 2 : 1 })}
              options={[
                { id: '1', label: 'Каждую неделю' },
                { id: '2', label: 'Раз в 2 недели' },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Окончание</span>
            <TabPicker
              variant="segment"
              stretch
              ariaLabel="Окончание"
              value={draft.endsOn ? 'until' : 'none'}
              onChange={(v) => onChange({ endsOn: v === 'until' ? addDays(draft.day, 7 * 9) : null })}
              options={[
                { id: 'none', label: 'Без даты' },
                { id: 'until', label: 'До даты' },
              ]}
            />
            {draft.endsOn && (
              <>
                <FieldButton Icon={IconCalendar} label="Последний день" open={calendar} onClick={() => setCalendar((o) => !o)}>
                  {dayShort(draft.endsOn)}
                </FieldButton>
                {calendar && (
                  <DatePicker
                    value={draft.endsOn}
                    today={today}
                    min={draft.day}
                    max={addDays(draft.day, 366 * 2)}
                    onChange={(endsOn) => onChange({ endsOn })}
                    onDone={() => setCalendar(false)}
                    label="Последний день серии"
                  />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function FormLink({
  link,
  defaultLink,
  group,
  title,
  onLink,
}: {
  link: string
  defaultLink: string | null
  group: boolean
  title: string
  onLink: (link: string) => void
}) {
  const [editing, setEditing] = useState(link !== '' || !defaultLink)
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) onLink(text.trim())
    } catch {
      /* буфер недоступен — вставят руками в поле */
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className={label}>Ссылка на урок</span>
      {!editing && defaultLink ? (
        <div className="flex min-h-12 items-center gap-2 rounded-xl bg-input px-3 ring-1 ring-control-line">
          <IconLink size={18} aria-hidden className="flex-none text-fg-muted" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{defaultLink.replace(/^https?:\/\//, '')}</span>
            <span className="text-caption text-fg-muted">Ссылка по умолчанию</span>
          </span>
          <button type="button" onClick={() => setEditing(true)} className="min-h-11 px-2 text-sm font-semibold text-accent-strong">
            Изменить
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => onLink(e.target.value)}
              placeholder="meet.google.com/…"
              aria-label="Ссылка на урок"
              className="min-h-12 min-w-0 flex-1 rounded-xl bg-input px-3.5 text-base ring-1 ring-control-line outline-none focus:ring-2 focus:ring-accent-line"
            />
            {defaultLink ? (
              <button type="button" onClick={() => {
                  onLink('')
                  setEditing(false)
                }} className="min-h-12 flex-none rounded-xl px-3 text-sm font-semibold text-accent-strong hover:bg-tint/[0.06]">
                По умолчанию
              </button>
            ) : (
              <button type="button" onClick={() => void paste()} className="min-h-12 flex-none rounded-xl px-3 text-sm font-semibold text-accent-strong hover:bg-tint/[0.06]">
                Вставить
              </button>
            )}
          </div>
          <p className="text-note text-fg-muted">
            {!defaultLink
              ? 'Вставь ссылку Google Meet или Zoom — запомним для следующих уроков'
              : group
                ? `Эта ссылка — только для группы «${title.trim() || 'без названия'}». Остальные уроки останутся со ссылкой по умолчанию.`
                : 'Эта ссылка — только для этого урока. Остальные останутся со ссылкой по умолчанию.'}
          </p>
        </>
      )}
    </div>
  )
}
