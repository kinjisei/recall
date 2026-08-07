// ============================================================================
// История попыток письма (Заход 5c) — общий рендер для ученика и преподавателя.
// Показывает прогресс баллов по циклам (5.5 → 6.5) + текст каждой попытки под тапом.
// ============================================================================
import { useState } from 'react'
import type { WritingAttempt } from '../../types'

export function WritingHistory({ attempts }: { attempts: WritingAttempt[] }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!attempts || attempts.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] uppercase tracking-wider text-[var(--night-text-40)]">
        История попыток ({attempts.length})
      </p>
      {attempts.map((a, i) => {
        const when = a.at ? new Date(a.at).toLocaleDateString() : ''
        return (
          <div key={i} className="rounded-xl border border-white/[0.08]">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
            >
              <span className="text-sm">
                Попытка {i + 1}
                {a.band ? <span className="text-[var(--night-accent-text)]"> · {a.band}</span> : null}
              </span>
              <span className="text-xs text-[var(--night-text-40)]">{when}</span>
            </button>
            {open === i && (
              <div className="border-t border-white/[0.06] px-3 py-2">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--night-text-70)]">
                  {a.essay}
                </p>
                {a.teacher_review?.comment && (
                  <p className="mt-2 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-sm text-[var(--night-text-70)]">
                    Учитель: {a.teacher_review.comment}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
