// ============================================================================
// «Как это работает?» — сворачиваемое пояснение на экране фичи.
//
// Зачем. Продукт вырос, и человек, зашедший сам (без преподавателя), не всегда
// понимает, что за раздел перед ним и зачем он нужен. Пояснение прямо на экране
// снимает вопрос, не уводя в справку и не занимая место у того, кто и так всё
// знает: по умолчанию свёрнуто, открывается тапом, закрывается им же.
//
// ⚠️ Один компонент на все экраны — иначе пояснения разъедутся по стилю и тону.
// Текст даёт каждый экран сам (children): что это, зачем и как этим пользоваться,
// человеческим языком, а не списком из трёх симметричных пунктов.
//
// Состояние НЕ запоминаем: это не баннер «принять», а всегда доступная
// подсказка. Свернул — свернул до следующего интереса, localStorage тут лишний.
// ============================================================================
import { useState, type ReactNode } from 'react'
import { IconHint, IconCaretDown } from './icons'
import { Reveal } from './Reveal'

export function HowItWorks({
  children,
  label = 'Как это работает?',
}: {
  children: ReactNode
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="-my-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        // min-h-[44px]: тач-цель по WCAG 2.5.5 (ux-audit §2 — тогл не inline
        // внутри текста, поэтому исключением для ссылок в предложении не крыт).
        className="flex min-h-[44px] items-center gap-1.5 text-sm text-[var(--night-text-40)] transition-colors hover:text-[var(--night-text-70)]"
      >
        <IconHint size={16} />
        <span>{label}</span>
        <IconCaretDown
          size={14}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <Reveal open={open}>
        <div className="mt-2 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-[var(--night-text-70)]">
          {children}
        </div>
      </Reveal>
    </div>
  )
}
