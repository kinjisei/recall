// ============================================================================
// «Методичка» — вкладка «Как учить» на экране преподавателя: аккордеоны
// разделов (цикл ведения, чтение диагностики, методики с источниками, ошибки).
// Контент — src/data/teacher-guide.ts (статический, без БД).
// ============================================================================
import { useState } from 'react'
import { Card } from '../../components/Card'
import { teacherGuide, type GuideBlock } from '../../data/teacher-guide'

function BlockView({ block }: { block: GuideBlock }) {
  return (
    <div className="border-t border-white/[0.06] pt-3 first:border-t-0 first:pt-0">
      <p className="text-sm font-semibold">{block.title}</p>
      <div className="mt-1.5 flex flex-col gap-1.5">
        {block.body.map((p, i) =>
          p.startsWith('• ') ? (
            <p key={i} className="flex gap-2 text-sm leading-relaxed text-[var(--night-text-70)]">
              <span className="text-[var(--night-accent-text)]">•</span>
              <span>{p.slice(2)}</span>
            </p>
          ) : (
            <p key={i} className="text-sm leading-relaxed text-[var(--night-text-70)]">
              {p}
            </p>
          ),
        )}
      </div>
      {block.sources && block.sources.length > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--night-text-40)]">
          Источники:{' '}
          {block.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ' · '}
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-[var(--night-text-70)]"
              >
                {s.title}
              </a>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

export function GuideSection() {
  const [open, setOpen] = useState<string | null>(teacherGuide[0]?.id ?? null)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--night-text-40)]">
        Как вести учениц в Recall: рабочий цикл, реакции на диагностику, проверенные
        методики и типичные ошибки. Читается за 15 минут, применяется годами.
      </p>

      {teacherGuide.map((s) => {
        const isOpen = open === s.id
        return (
          <div key={s.id}>
            <button
              onClick={() => setOpen((cur) => (cur === s.id ? null : s.id))}
              className="flex min-h-[44px] w-full items-center justify-between rounded-lg bg-white/[0.06] px-3 py-2 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-bold">{s.title}</span>
              <span className="text-[var(--night-text-40)]">{isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && (
              <Card className="mt-2 flex flex-col gap-3">
                {s.intro && (
                  <p className="text-sm leading-relaxed text-[var(--night-text-60)]">{s.intro}</p>
                )}
                {s.blocks.map((b) => (
                  <BlockView key={b.title} block={b} />
                ))}
              </Card>
            )}
          </div>
        )
      })}
    </div>
  )
}
