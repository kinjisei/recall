// ============================================================================
// Куски Настроек (макеты d14, u4): карточка раздела и оглавление справа.
//
// Карточка (`.s14`): заголовок 17, пояснение под ним, поля 18 / 20, радиус 24;
// у каждой — якорь (`id`), оглавление ведёт к ней и подсвечивает ту, что
// сейчас на экране. Оглавление (`.tc14`) — только на компьютере, держится при
// прокрутке (MainAside nav), внизу «Сохраняется сразу, кроме имени и уровня».
// ============================================================================
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconCheck } from '../../shared/ui/icons'

interface SettingsPart {
  id: string
  title: string
}

export function SettingsCard({
  id,
  title,
  toc,
  note,
  children,
}: {
  id: string
  title: string
  /** Как раздел назван в оглавлении, если не как заголовок («Помощь»). */
  toc?: string
  note?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-6 flex-col gap-3.5 rounded-card bg-surface px-5 pb-5 pt-4.5 shadow-card"
      data-settings-part={toc ?? title}
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-lg font-semibold text-fg">
          {title}
        </h2>
        {note && <p className="text-sm text-fg-secondary">{note}</p>}
      </div>
      {children}
    </section>
  )
}

/**
 * Строка-значение на подложке поля (`.v14`): что сейчас и действие справа.
 * В узкой карточке (телефон, уже 448) действие — под полем во всю ширину, как
 * «Изменить ссылку» в u4-2: в строке ссылка и адрес обрезались до «meet.goo…».
 */
export function ValueRow({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="@container">
      <div className="flex flex-col gap-2 text-body @md:flex-row @md:items-center @md:gap-3 @md:rounded-control-sm @md:bg-input @md:py-1 @md:pl-3.5 @md:pr-1.5">
        <span className="flex min-h-13 min-w-0 flex-1 items-center gap-3 rounded-control-sm bg-input px-3.5 @md:min-h-11 @md:bg-transparent @md:px-0">{children}</span>
        {action && <span className="flex *:flex-1 @md:*:flex-none">{action}</span>}
      </div>
    </div>
  )
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Оглавление: разделы — те карточки, что сейчас стоят на странице внутри
 * `rootId` (раздел «Уведомления» подгружается сам и есть не у всех — список
 * в коде с ним бы разошёлся). Раздел, который сейчас на экране, подсвечен;
 * нажал — прокрутка к нему.
 */
export function SettingsToc({ rootId }: { rootId: string }) {
  const [parts, setParts] = useState<SettingsPart[]>([])
  const [current, setCurrent] = useState('')
  const visible = useRef(new Set<string>())
  const key = parts.map((p) => p.id).join('|')

  // разделы — со страницы; перечитываем, когда она меняется (раздел подгрузился)
  useEffect(() => {
    const root = document.getElementById(rootId)
    if (!root) return
    const scan = () => {
      const list = [...root.querySelectorAll<HTMLElement>('[data-settings-part]')].map((el) => ({ id: el.id, title: el.dataset.settingsPart ?? '' }))
      setParts((prev) => (prev.map((p) => p.id).join('|') === list.map((p) => p.id).join('|') ? prev : list))
    }
    const raf = requestAnimationFrame(scan)
    const mo = new MutationObserver(scan)
    mo.observe(root, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(raf)
      mo.disconnect()
    }
  }, [rootId])

  useEffect(() => {
    const els = parts.map((p) => document.getElementById(p.id)).filter((e): e is HTMLElement => !!e)
    // «на экране» — верхняя половина окна: раздел, до которого дочитали, а не тот, что выглядывает снизу
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.current.add(e.target.id)
          else visible.current.delete(e.target.id)
        }
        const first = parts.find((p) => visible.current.has(p.id))
        if (first) setCurrent(first.id)
      },
      { rootMargin: '0px 0px -50% 0px' },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
    // parts — новый массив на каждую отрисовку; важен только состав
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (
    <nav aria-label="Разделы настроек" className="flex flex-col gap-0.5 rounded-row bg-surface px-2 py-3.5 shadow-card" data-settings-toc>
      <span className="px-2.5 pb-1.5 text-note font-semibold text-fg-muted">Разделы</span>
      {parts.map((p, i) => {
        const on = p.id === current || (!current && i === 0)
        return (
          <button
            key={p.id}
            type="button"
            aria-current={on ? 'location' : undefined}
            onClick={() => {
              setCurrent(p.id)
              document.getElementById(p.id)?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })
            }}
            className={`flex min-h-11 items-center rounded-control-sm px-2.5 text-left text-body ${on ? 'bg-accent-soft font-semibold text-accent-soft-fg' : 'text-fg-secondary hover:text-fg'}`}
          >
            {p.title}
          </button>
        )
      })}
      <span className="mx-2.5 mt-2 flex items-start gap-1.5 border-t border-line pt-2.5 text-note text-fg-muted">
        <IconCheck size={14} aria-hidden className="mt-0.5 flex-none" />
        Сохраняется сразу, кроме имени и уровня
      </span>
    </nav>
  )
}
