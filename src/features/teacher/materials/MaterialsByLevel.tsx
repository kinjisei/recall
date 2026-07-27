// Библиотека материалов, сгруппированная по уровням (A1…C1, сворачиваемые
// секции — как паки слов). Внутри уровня порядок прежний: свежие сверху.
// Раньше все материалы шли одной лентой по дате — с ростом библиотеки найти
// текст нужного уровня было нельзя.
import { useState } from 'react'
import { Card } from '../../../components/Card'
import type { Material } from '../../../types'

export function MaterialsByLevel({
  materials,
  onOpen,
}: {
  materials: Material[]
  onOpen: (m: Material) => void
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const groups = order
    .map((level) => ({ level, items: materials.filter((m) => m.level === level) }))
    .filter((g) => g.items.length > 0)
  // материалы с нестандартным уровнем не прячем
  const other = materials.filter((m) => !order.includes(m.level))
  if (other.length > 0) groups.push({ level: 'Другое', items: other })

  return (
    <div className="flex flex-col gap-2">
      {groups.map(({ level, items }) => (
        <div key={level}>
          <button
            onClick={() => setClosed((c) => ({ ...c, [level]: !c[level] }))}
            className="flex min-h-[44px] w-full items-center justify-between px-1 text-left"
          >
            <span className="text-sm font-semibold text-[var(--night-text-70)]">
              {level}
              <span className="ml-2 text-xs font-normal text-[var(--night-text-40)]">
                {items.length}
              </span>
            </span>
            <span className="text-[var(--night-text-40)]">{closed[level] ? '▸' : '▾'}</span>
          </button>
          {!closed[level] && (
            <div className="flex flex-col gap-2">
              {items.map((m) => (
                <button key={m.id} onClick={() => onOpen(m)} className="text-left">
                  <Card className="flex items-center justify-between gap-2 transition-transform active:scale-[0.99]">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.title ?? m.topic}</p>
                      <p className="text-xs text-[var(--night-text-40)]">
                        {m.lang.toUpperCase()} · {m.level} · {m.format} · {m.length_range} слов ·{' '}
                        {m.exercises.length} упр.
                      </p>
                    </div>
                    <span className="shrink-0 text-[var(--night-text-40)]">›</span>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
