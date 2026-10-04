// ============================================================================
// Колёса «Часы : Минуты» (макет t3-4; решение владельца 04.10.2026 — свои, как
// в макете). Каждое колесо — обычная прокрутка с прилипанием (CSS scroll-snap),
// без библиотек: значение — строка под полосой посередине.
//
// Как устроено, чтобы не прыгало на телефоне:
//   • значение берём, когда прокрутка остановилась (scrollend, а где его нет —
//     пауза 120 мс), а не на каждом пикселе инерции;
//   • снаружи пришло новое значение — колесо встаёт на него без анимации и не
//     сообщает его обратно (ref `quiet`), иначе выходит петля;
//   • нажатие на строку прокручивает к ней — так выбирают мышью.
// Клавиатура и читалка: колесо — spinbutton, стрелки ↑↓ меняют на шаг.
// ============================================================================
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { formatTime, parseTime } from '../lib/days'

const ROW = 36 // высота строки, px — h-9
const VISIBLE = 5 // строк видно: выбранная посередине

function Wheel({ values, value, onChange, label }: { values: number[]; value: number; onChange: (v: number) => void; label: string }) {
  const box = useRef<HTMLDivElement>(null)
  const quiet = useRef(false)
  const timer = useRef(0)
  const index = Math.max(0, values.indexOf(value))

  // встать на значение снаружи
  useEffect(() => {
    const el = box.current
    if (!el || Math.round(el.scrollTop / ROW) === index) return
    quiet.current = true
    el.scrollTop = index * ROW
  }, [index])

  const settle = () => {
    const el = box.current
    if (!el) return
    if (quiet.current) {
      quiet.current = false
      return
    }
    const v = values[Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)))]
    if (v !== undefined && v !== value) onChange(v)
  }
  const onScroll = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(settle, 120)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const go = (i: number) => {
    const v = values[Math.min(values.length - 1, Math.max(0, i))]
    if (v !== undefined) onChange(v)
  }
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }[e.key]
    if (step !== undefined) {
      e.preventDefault()
      go(index + step)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      go(e.key === 'Home' ? 0 : values.length - 1)
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center">
      <span className="pb-1 text-caption text-fg-muted">{label}</span>
      <div
        ref={box}
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={values[0] ?? 0}
        aria-valuemax={values[values.length - 1] ?? 0}
        aria-valuetext={String(value).padStart(2, '0')}
        onScroll={onScroll}
        onKeyDown={onKey}
        className="scrollbar-none relative h-45 w-full snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-focus"
        style={{ scrollPaddingTop: ROW * 2 }}
      >
        <div style={{ height: ROW * 2 }} aria-hidden />
        {values.map((v, i) => (
          <button
            key={v}
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => go(i)}
            className={`flex h-9 w-full snap-start items-center justify-center tabular-nums transition-colors ${
              i === index ? 'text-lg font-bold text-fg' : Math.abs(i - index) === 1 ? 'text-base text-fg-secondary' : 'text-sm text-fg-muted'
            }`}
          >
            {String(v).padStart(2, '0')}
          </button>
        ))}
        <div style={{ height: ROW * (VISIBLE - 3) }} aria-hidden />
      </div>
    </div>
  )
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function TimeWheel({
  value,
  onChange,
  minuteStep = 1,
}: {
  /** «18:00» */
  value: string
  onChange: (time: string) => void
  /** Шаг минут: в макете — 1. */
  minuteStep?: number
}) {
  const [h, m] = parseTime(value)
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep)
  const set = (hh: number, mi: number) => onChange(formatTime(hh, mi))
  return (
    <div className="relative flex items-stretch gap-2 rounded-2xl border border-tint/[0.08] bg-surface px-3 pb-2 pt-2 shadow-card">
      {/* полоса выбранного значения — под строкой посередине колёс */}
      <span aria-hidden className="pointer-events-none absolute inset-x-3 bottom-2 h-9 -translate-y-18 rounded-xl bg-accent-soft/60" />
      <Wheel values={HOURS} value={h} onChange={(v) => set(v, m)} label="Часы" />
      <span aria-hidden className="self-end pb-20 text-lg font-bold text-fg">
        :
      </span>
      <Wheel values={minutes} value={minutes.includes(m) ? m : 0} onChange={(v) => set(h, v)} label="Минуты" />
    </div>
  )
}
