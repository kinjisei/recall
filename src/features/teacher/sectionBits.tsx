// ============================================================================
// Общие куски разделов карточки ученика (макеты d10-2…d10-4, PLAN.md
// Ф2.17-4б-2): карточка раздела (радиус 18, заголовок с тихой подписью и
// действием справа), метка статуса, сведение с «i» на подложке поля и подвал с главным
// действием раздела, который держится снизу панели — на телефоне над
// навигацией, — пока прокручиваешь список. Подвал — последний в разделе и
// выходит на края панели (поля раздела — 16 px, StudioSection).
// ============================================================================
import type { ReactNode } from 'react'
import { useShellInsets } from '../../shared/lib/shellInsets'
import { IconInfo } from '../../shared/ui/icons'

/** Карточка раздела (d10-2 `.c10`): «Слова  86 в колоде          [+ Выдать]». */
export function SectionCard({
  title,
  note,
  action,
  children,
  className = '',
}: {
  title: string
  note?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section aria-label={title} className={`flex flex-col gap-3 rounded-control-lg bg-surface px-4.5 py-4 shadow-card ${className}`}>
      <header className="flex min-w-0 items-center gap-2">
        <h3 className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 text-base font-semibold text-fg">
          {title}
          {note && <small className="text-note font-normal text-fg-muted">{note}</small>}
        </h3>
        {action}
      </header>
      {children}
    </section>
  )
}

/** Сведение с «i» (d10-2 `.emp10`): пусто и почему. raised — отдельной карточкой. */
export function InfoBox({ children, raised = false }: { children: ReactNode; raised?: boolean }) {
  return (
    <p className={`flex gap-2.5 rounded-control-sm px-3.5 py-3 text-sm leading-relaxed text-fg-secondary ${raised ? 'bg-surface shadow-card' : 'bg-input'}`}>
      <IconInfo size={18} aria-hidden className="mt-0.5 flex-none text-fg-muted" />
      <span>{children}</span>
    </p>
  )
}

/** Метка статуса справа в строке (d10-2 `.pill9`): ждёт — жёлтая, готово — зелёная, остальное — нейтральная. */
export function Pill({ tone, children }: { tone: 'wait' | 'ok' | 'plain'; children: ReactNode }) {
  const look = tone === 'wait' ? 'bg-warning-soft text-warning-soft-fg' : tone === 'ok' ? 'bg-success-soft text-success-soft-fg' : 'bg-input text-fg-secondary'
  return <span className={`inline-flex h-6.5 flex-none items-center whitespace-nowrap rounded-full px-2.5 text-note font-semibold ${look}`}>{children}</span>
}

/** Подвал раздела (d10-3 `.ft10`): «Выбрано 3 · уйдут Айгерим в приложение  [Назначить]». */
export function SectionFooter({ text, children }: { text: ReactNode; children: ReactNode }) {
  const { bottom } = useShellInsets()
  // на компьютере панель прокручивается сама и снизу у неё поле 16 px: закреплённый
  // подвал встаёт на 16 px выше её края, и в просвете ехало содержимое — закрываем
  // просвет фоном подвала (`after`); край карточки его обрезает (4г-1)
  return (
    <div
      style={{ bottom }}
      data-section-footer
      className="@container sticky z-10 -mx-4 -mb-4 mt-auto border-t border-line bg-surface px-4 py-3 rail:after:absolute rail:after:inset-x-0 rail:after:top-full rail:after:h-4 rail:after:bg-surface"
    >
      {/* уже 448 px (телефон) — подпись над кнопкой во всю ширину: рядом подпись шла в четыре строки */}
      <div className="flex flex-col gap-2 *:w-full @md:flex-row @md:items-center @md:gap-3 @md:*:w-auto">
        <span className="min-w-0 flex-1 text-sm text-fg-secondary">{text}</span>
        {children}
      </div>
    </div>
  )
}
