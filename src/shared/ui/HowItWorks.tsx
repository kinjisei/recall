// ============================================================================
// «Как это работает?» — сворачиваемое пояснение на экране фичи.
//
// Зачем. Продукт вырос, и человек, зашедший сам (без преподавателя), не всегда
// понимает, что за раздел перед ним и зачем он нужен. Пояснение прямо на экране
// снимает вопрос, не уводя в справку и не занимая место у того, кто и так всё
// знает: по умолчанию свёрнуто, открывается тапом, закрывается им же.
//
// ⚠️ Один компонент на все экраны — иначе пояснения разъедутся по стилю и тону.
// Тексты всех экранов — в src/data/howItWorks.ts, экран передаёт свой
// (children): что это, как обычно проходит занятие и куда идти дальше,
// человеческим языком, а не списком из трёх симметричных пунктов.
//
// Состояние НЕ запоминаем: это не баннер «принять», а всегда доступная
// подсказка. Свернул — свернул до следующего интереса, localStorage тут лишний.
//
// Вариант значком (?) — для экрана, где заголовок, значок и действия стоят
// одной строкой («Ученики», PLAN.md Ф2.11б-2): строка «Как это работает?»
// отдельно занимала место над списком. Значок — в строке заголовка
// (HintButton), пояснение — под ней (HintPanel); раскрыто один раз, при
// первом заходе на экран (useHint): тому, кто пришёл впервые, объяснение
// нужно сразу, дальше оно ждёт за значком. Запоминаем только «уже видел».
// ============================================================================
import { useEffect, useState, type ReactNode } from 'react'
import { readRaw, writeRaw } from '../lib/storage'
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
        // min-h-11 (44 px): тач-цель по WCAG 2.5.5 (ux-audit §2 — тогл не inline
        // внутри текста, поэтому исключением для ссылок в предложении не крыт).
        className="flex min-h-11 items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-secondary"
      >
        <IconHint size={16} />
        <span>{label}</span>
        <IconCaretDown
          size={14}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <HintPanel open={open}>{children}</HintPanel>
    </div>
  )
}

/**
 * Раскрыто ли пояснение экрана `screen`: при первом заходе — да, дальше — по
 * нажатию. «Уже видел» запоминается, когда пояснение побыло на экране
 * (`shown`) секунду: пришёл по ссылке сразу в карточку ученика, где шапки
 * нет, — пояснение дождётся первого захода в сам список. Секунда — потому
 * что экран узнаёт «шапки нет» уже после первой отрисовки.
 */
export function useHint(screen: string, shown = true): { open: boolean; toggle: () => void } {
  const key = `recall.hint-seen.${screen}`
  const [open, setOpen] = useState(() => readRaw(key) === null)
  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => writeRaw(key, '1'), 1000)
    return () => clearTimeout(t)
  }, [key, shown])
  return { open, toggle: () => setOpen((v) => !v) }
}

/** Значок (?) в строке заголовка: открывает и закрывает HintPanel. */
export function HintButton({
  open,
  onToggle,
  label = 'Как это работает?',
}: {
  open: boolean
  onToggle: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={label}
      title={label}
      className={`flex size-11 flex-none items-center justify-center rounded-full transition-colors ${
        open ? 'text-accent-strong' : 'text-fg-muted hover:text-fg-secondary'
      }`}
    >
      <span
        aria-hidden
        className="flex size-6 items-center justify-center rounded-full border-2 border-current text-xs font-bold"
      >
        ?
      </span>
    </button>
  )
}

/** Само пояснение — плашкой под строкой, где стоит его кнопка. */
export function HintPanel({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <Reveal open={open}>
      <div className="mt-2 rounded-2xl bg-tint/[0.04] px-4 py-3 text-sm leading-relaxed text-fg-secondary">
        {children}
      </div>
    </Reveal>
  )
}
