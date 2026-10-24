// Куски онбординга ученика (OnboardingFlow): заголовок шага, вопрос «Как
// узнал» и класс главной кнопки. У репетитора свои — по макету t10
// (teacher/parts.tsx).
import { useState } from 'react'
import { setSelfReportedSource } from '../../lib/analytics'
import { fieldClass } from '../../shared/ui/TextField'

// Главные кнопки онбординга: скругление 16 и вес 500. «!» — потому что
// обычный класс проиграл бы базе Button (rounded-control, font-semibold) по
// порядку в CSS, а не по порядку в строке. Выключенный вид — общий у Button
// (подложка input, текст fg-faint, лист s3): своя прозрачность поверх него
// сделала бы подпись нечитаемой.
export const ONBOARDING_CTA = 'rounded-control! font-medium!'

/** Поле кода преподавателя: поле s3 (4д-2), код крупно и вразрядку. */
export const CODE_FIELD = `${fieldClass()} text-center text-lg tracking-widest`

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
      {/* без рода (Ф2.24, П18): «узнал» читалось бы ученице как не к ней */}
      <p className="text-sm text-fg-muted">Откуда ты о нас знаешь?</p>
      <div className="flex flex-wrap gap-2">
        {options.map((h) => (
          <button
            key={h}
            aria-pressed={heard === h}
            onClick={() => {
              setHeard(h)
              setSelfReportedSource(h)
            }}
            className={`min-h-11 rounded-control-sm border px-3.5 py-2 text-sm ${
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
