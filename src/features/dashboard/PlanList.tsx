// ============================================================================
// «План на сегодня» (макеты u1-1, d4-v2): пункты по линии — сделанный залит
// и с галочкой, справа «Сделано»; следующий обведён акцентом, «дальше»;
// остальные — серый круг со своей иконкой. Линия между кружками после
// сделанного — акцентом. Телефон: строка 64, круг 44, заголовок 20; в
// карточке компьютера с «Начать занятие» (`compact`, d4-v2) — 50, 36, 18.
// Строки раскрываются по очереди (`animate-stagger-in`, лист s4).
// ============================================================================
import type { CSSProperties } from 'react'
import { AppLink } from '../../shared/ui/AppLink'
import { IconCheck, IconChevronRight, type IconLike } from '../../shared/ui/icons'

export interface PlanRow {
  key: string
  title: string
  /** Тихая подпись: «9 слов», «Несданных: 2». */
  detail?: string
  to: string
  done: boolean
  Icon: IconLike
}

export function PlanList({ rows, pill, compact = false }: { rows: PlanRow[]; pill: string; compact?: boolean }) {
  const next = rows.findIndex((r) => !r.done)
  return (
    <section aria-labelledby="home-plan" className={`flex flex-col ${compact ? 'gap-0.5' : 'gap-2.5 pt-1.5'}`}>
      <div className={`flex items-center justify-between ${compact ? 'px-0.5 pb-1' : 'px-1'}`}>
        <h2 id="home-plan" className={`font-semibold text-fg ${compact ? 'text-lg' : 'text-xl'}`}>
          План на сегодня
        </h2>
        <span className={`rounded-full bg-input px-2.5 font-medium text-fg-secondary ${compact ? 'py-0.5 text-note' : 'py-1 text-sm'}`}>
          {pill}
        </span>
      </div>
      <div className="flex flex-col px-1">
        {rows.map((r, i) => {
          const isNext = i === next
          return (
            <AppLink
              key={r.key}
              to={r.to}
              style={{ '--i': i } as CSSProperties}
              className={`animate-stagger-in relative flex items-center text-fg ${compact ? 'h-12.5 gap-3 text-body font-medium' : 'h-16 gap-3.5 text-base font-medium'}`}
            >
              {/* линия от прошлого кружка: под кружками, видна в промежутке */}
              {i > 0 && (
                <span
                  aria-hidden
                  className={`absolute w-0.5 ${rows[i - 1]!.done ? 'bg-accent' : 'bg-line'} ${compact ? '-top-3.5 left-4.25 h-7' : '-top-8 left-5.25 h-16'}`}
                />
              )}
              <span
                className={`relative flex flex-none items-center justify-center rounded-full ${compact ? 'size-9' : 'size-11'} ${
                  r.done
                    ? 'bg-accent text-accent-fg'
                    : isNext
                      ? 'border-2 border-accent bg-surface text-accent-strong'
                      : 'border-2 border-line bg-surface text-fg-muted'
                }`}
              >
                {r.done ? <IconCheck size={compact ? 18 : 20} aria-hidden /> : <r.Icon size={compact ? 18 : 20} aria-hidden />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate">{r.title}</span>
                {(r.detail || isNext) && (
                  <small className={`truncate font-normal ${compact ? 'text-xs' : 'text-note'} text-fg-muted`}>
                    {r.detail}
                    {r.detail && isNext && ' · '}
                    {isNext && <span className="text-accent-strong">{compact ? 'дальше' : 'Дальше'}</span>}
                  </small>
                )}
              </span>
              {r.done ? (
                <span className="flex-none text-note font-medium text-success-strong">Сделано</span>
              ) : (
                <IconChevronRight size={20} aria-hidden className="flex-none text-fg-faint" />
              )}
            </AppLink>
          )
        })}
      </div>
    </section>
  )
}
