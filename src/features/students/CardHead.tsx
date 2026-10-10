// ============================================================================
// Шапка карточки ученика (макеты t6-2, t6-3, d3): аватар, имя, статус,
// «в приложении», кнопки связи из контакта, заметка и меню «⋯» — изменить,
// пауза, архив, вернуть. На телефоне сверху «‹ Ученики»: карточка — отдельный
// экран, свайп-назад возвращает к списку (выбор — в адресе).
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import {
  ACTION_LABEL,
  cardActions,
  contactLinks,
  type CardAction,
  type StudentCard,
} from '../../domains/students'
import { IconBack, IconDialog, IconPencil, IconPhone, IconSend } from '../../shared/ui/icons'
import { AppBadge, Avatar, StatusBadge } from './CardBits'

// Телефон (t6-2): значок над подписью, три кнопки на всю ширину — влезают и на
// 360 px. Компьютер (d3): короткие кнопки строкой у имени.
const contactBase =
  'lift flex items-center justify-center rounded-xl border border-tint/[0.08] bg-surface font-semibold text-accent-strong [&>svg]:flex-none'
const contactPhone = `${contactBase} min-h-14 min-w-0 flex-1 flex-col gap-1 px-1 py-2 text-note`
const contactDesk = `${contactBase} min-h-11 gap-1.5 px-3 text-sm`

export function CardHead({
  card,
  level,
  goal,
  outside,
  canWrite,
  busy,
  onBack,
  onAction,
}: {
  card: StudentCard
  /** Уровень ученика в приложении (тест уровня), если известен. */
  level?: string | null
  /** Цель ученика словами — с ней по-разному строятся занятия (IELTS и школа). */
  goal?: string | null
  /** В приложении, места тарифа не хватило. */
  outside: boolean
  canWrite: boolean
  busy: boolean
  /** Есть — показать «‹ Ученики» (телефон). */
  onBack?: () => void
  onAction: (action: CardAction) => void
}) {
  const links = contactLinks(card.contact)
  const anyLink = links.whatsapp || links.telegram || links.phone
  const contactCls = onBack ? contactPhone : contactDesk
  // без тарифа после пробного менять нечего — меню нет (журнал п.41)
  const menu = canWrite ? <CardMenu actions={cardActions(card.status)} busy={busy} onPick={onAction} /> : null

  return (
    <div className="flex flex-col gap-4">
      {/* Телефон: «‹ Ученики» и «⋯» строкой сверху; компьютер — «⋯» в строке имени */}
      {onBack && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 flex min-h-11 items-center gap-1 rounded-xl px-2 text-accent-strong"
          >
            <IconBack size={20} /> Ученики
          </button>
          {menu}
        </div>
      )}

      <div className={`flex gap-4 ${onBack ? 'flex-col items-center text-center' : 'items-center'}`}>
        <Avatar name={card.name} inApp={card.inApp} large />
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-2xl font-bold" data-card-name>
            {card.name}
          </h2>
          <div className={`mt-2 flex flex-wrap gap-1.5 ${onBack ? 'justify-center' : ''}`}>
            <StatusBadge status={card.status} />
            <AppBadge inApp={card.inApp} />
            {card.inApp && level && (
              <span className="rounded-full bg-tint/[0.06] px-2 py-0.5 text-xs font-semibold text-fg-secondary">
                {level}
              </span>
            )}
          </div>
          {card.inApp && goal && <p className="mt-1.5 text-xs text-fg-muted">Цель: {goal}</p>}
        </div>
        {!onBack && menu}
      </div>

      {outside && (
        <p className="rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning-soft-fg">
          Вне мест тарифа — AI по бесплатным лимитам. Чтобы включить в тариф, убери из него
          другого ученика или расширь тариф.
        </p>
      )}

      {anyLink ? (
        <div className="flex gap-2">
          {links.whatsapp && (
            <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={contactCls}>
              <IconDialog size={18} /> WhatsApp
            </a>
          )}
          {links.telegram && (
            <a href={links.telegram} target="_blank" rel="noopener noreferrer" className={contactCls}>
              <IconSend size={18} /> Telegram
            </a>
          )}
          {links.phone && (
            <a href={links.phone} className={contactCls}>
              <IconPhone size={18} /> Позвонить
            </a>
          )}
        </div>
      ) : (
        card.contact && <p className="text-sm text-fg-secondary">Контакт: {card.contact}</p>
      )}

      {card.note && (
        <p className="whitespace-pre-line break-words rounded-xl bg-tint/[0.04] px-3 py-2 text-sm text-fg-secondary">
          {card.note}
        </p>
      )}
    </div>
  )
}

/** Меню «⋯»: закрывается вторым нажатием, кликом мимо и Escape. */
function CardMenu({
  actions,
  busy,
  onPick,
}: {
  actions: CardAction[]
  busy: boolean
  onPick: (action: CardAction) => void
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label="Действия с учеником"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center rounded-xl text-xl font-bold text-fg-secondary hover:bg-tint/[0.06] disabled:opacity-50"
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-30 min-w-56 animate-pop-in overflow-hidden rounded-2xl border border-tint/[0.08] bg-surface py-1 shadow-card"
        >
          {actions.map((a) => (
            <button
              key={a}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onPick(a)
              }}
              className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm hover:bg-tint/[0.05]"
            >
              {a === 'edit' && <IconPencil size={18} className="text-fg-muted" />}
              {ACTION_LABEL[a]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
