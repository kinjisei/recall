// Общие куски онбординга ученика (OnboardingFlow) и репетитора (StepTeacher):
// заголовок шага, вопрос «Как узнал» и класс главной кнопки.
import { useState } from 'react'
import { setSelfReportedSource } from '../../lib/analytics'

// Главные кнопки онбординга крупнее обычных: скругление 16 и вес 500. «!» —
// потому что обычный класс проиграл бы базе Button (rounded-xl, font-semibold)
// по порядку в CSS, а не по порядку в строке.
export const ONBOARDING_CTA = 'rounded-2xl! font-medium! disabled:opacity-40!'

export function Heading({
  title,
  desc,
  center = false,
}: {
  title: string
  desc: string
  center?: boolean
}) {
  return (
    <div className={`flex flex-col gap-2 ${center ? 'items-center text-center' : ''}`}>
      <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      <p className="text-sm text-fg-muted">{desc}</p>
    </div>
  )
}

/**
 * «Как узнал» — единственный источник, который переживает пересылку ссылки
 * без параметров (а в телеграме и вотсапе так пересылают почти всегда) и
 * ловит сарафан, которого метки не видят вовсе. Отдельным шагом не делаем:
 * это налог на всех ради одной строки. Ответ необязателен.
 */
export function HowHeard({ options }: { options: string[] }) {
  const [heard, setHeard] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm text-fg-muted">Как ты о нас узнал?</p>
      <div className="flex flex-wrap gap-2">
        {options.map((h) => (
          <button
            key={h}
            aria-pressed={heard === h}
            onClick={() => {
              setHeard(h)
              setSelfReportedSource(h)
            }}
            className={`min-h-11 rounded-xl border px-3.5 py-2 text-sm ${
              heard === h
                ? 'border-accent-line bg-accent-soft text-accent-soft-fg'
                : 'border-tint/[0.08] bg-surface text-fg-secondary'
            }`}
          >
            {h}
          </button>
        ))}
      </div>
    </div>
  )
}
