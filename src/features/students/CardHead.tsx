// ============================================================================
// Шапка карточки ученика (макеты t6-2, t6-3, t6-4 — телефон, d10-1 —
// компьютер; PLAN.md Ф2.17-4б-2): аватар, имя, статус, «в приложении»,
// уровень, кнопки связи из контакта, заметка и меню «⋯» — изменить, пауза,
// архив, вернуть.
// Телефон: сверху «‹ Ученики» и «⋯» (карточка — отдельный экран, свайп-назад
// возвращает к списку, выбор — в адресе), герой по центру (аватар 72), три
// кнопки связи плитками — значок над подписью, влезают и на 360 px.
// Компьютер: аватар 60 и имя строкой, под ними кнопки связи и «⋯» одним
// рядом (d10-1).
// ============================================================================
import type { ReactNode } from 'react'
import {
  ACTION_LABEL,
  cardActions,
  contactLinks,
  type CardAction,
  type StudentCard,
} from '../../domains/students'
import { Badge } from '../../shared/ui/Badge'
import { IconArchive, IconBack, IconCheck, IconDialog, IconMore, IconPause, IconPencil, IconPhone, IconRefresh, IconSend, type IconLike } from '../../shared/ui/icons'
import { MenuItem, MenuPanel, useMenu } from '../../shared/ui/Menu'
import { AppBadge, Avatar, StatusBadge } from './CardBits'

/** Значок пункта меню «⋯» (t6-3). */
const ACTION_ICON: Record<CardAction, IconLike> = {
  edit: IconPencil,
  activate: IconCheck,
  pause: IconPause,
  resume: IconRefresh,
  archive: IconArchive,
  unarchive: IconRefresh,
}

// Кнопка связи — поверхность и тонкая рамка, текст акцентом (d10-1, t6-2).
// Телефон — плитка: значок над подписью; компьютер — строкой, высота 44.
const contactBase = 'flex items-center justify-center bg-surface font-medium text-accent-strong ring-1 ring-inset ring-line transition-colors active:bg-row-press [&>svg]:flex-none'
const contactPhone = `${contactBase} min-h-16 min-w-0 flex-1 flex-col gap-1 rounded-control px-1 py-2 text-note font-semibold shadow-card`
const contactDesk = `${contactBase} min-h-11 gap-1.5 rounded-control-sm px-3 text-sm`

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
  const phone = !!onBack
  const links = contactLinks(card.contact)
  const contactCls = phone ? contactPhone : contactDesk
  // без тарифа после пробного менять нечего — меню нет (журнал п.41)
  const menu = canWrite ? <CardMenu actions={cardActions(card.status)} busy={busy} boxed={!phone} onPick={onAction} /> : null
  const contacts: ReactNode[] = []
  if (links.whatsapp)
    contacts.push(
      <a key="wa" href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={contactCls}>
        <IconDialog size={phone ? 20 : 18} aria-hidden /> WhatsApp
      </a>,
    )
  if (links.telegram)
    contacts.push(
      <a key="tg" href={links.telegram} target="_blank" rel="noopener noreferrer" className={contactCls}>
        <IconSend size={phone ? 20 : 18} aria-hidden /> Telegram
      </a>,
    )
  if (links.phone)
    contacts.push(
      <a key="call" href={links.phone} className={contactCls}>
        <IconPhone size={phone ? 20 : 18} aria-hidden /> Позвонить
      </a>,
    )

  return (
    <div className="flex flex-col gap-4">
      {phone && (
        <div className="-mb-1 flex items-center justify-between gap-2">
          <button type="button" onClick={onBack} className="-ml-2 flex min-h-11 items-center gap-1 rounded-control-sm px-2 text-base text-accent-strong">
            <IconBack size={20} aria-hidden /> Ученики
          </button>
          {menu}
        </div>
      )}

      <div className={`flex gap-4 ${phone ? 'flex-col items-center text-center' : 'items-center'}`}>
        <Avatar name={card.name} inApp={card.inApp} size={phone ? 72 : 60} />
        <div className="min-w-0 flex-1">
          <h2 className="mb-1.5 break-words text-2xl font-semibold text-fg" data-card-name>
            {card.name}
          </h2>
          <div className={`flex flex-wrap gap-1.5 ${phone ? 'justify-center' : ''}`}>
            <StatusBadge status={card.status} />
            <AppBadge inApp={card.inApp} />
            {card.inApp && level && <Badge>{level}</Badge>}
          </div>
          {card.inApp && goal && <p className="mt-1.5 text-xs text-fg-muted">Цель: {goal}</p>}
        </div>
        {/* связаться нечем — «⋯» справа от имени, а не одиноким рядом */}
        {!phone && contacts.length === 0 && menu}
      </div>

      {outside && (
        <p className="rounded-control bg-warning-soft px-3 py-2 text-sm text-warning-soft-fg">
          Вне мест тарифа — AI по бесплатным лимитам. Чтобы включить в тариф, убери из него другого ученика или расширь тариф.
        </p>
      )}

      {/* кнопки связи; на компьютере в том же ряду — «⋯» (d10-1) */}
      {contacts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {contacts}
          {!phone && menu}
        </div>
      )}
      {contacts.length === 0 && card.contact && <p className="text-sm text-fg-secondary">Контакт: {card.contact}</p>}

      {card.note && <p className="whitespace-pre-line break-words rounded-control bg-input px-3 py-2 text-sm text-fg-secondary">{card.note}</p>}
    </div>
  )
}

/** Меню «⋯» (общее меню, shared/ui/Menu): закрывается вторым нажатием, кликом мимо и Escape. */
function CardMenu({
  actions,
  busy,
  boxed,
  onPick,
}: {
  actions: CardAction[]
  busy: boolean
  /** Компьютер: квадрат 44 в ряду кнопок связи, с рамкой (d10-1); телефон — значок в строке «‹ Ученики». */
  boxed: boolean
  onPick: (action: CardAction) => void
}) {
  const { open, leaving, close, trigger, box } = useMenu()
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label="Действия с учеником"
        disabled={busy}
        {...trigger}
        className={`flex size-11 items-center justify-center text-fg disabled:opacity-50 ${boxed ? `${contactBase} rounded-control-sm` : 'rounded-full active:bg-ghost-press'}`}
      >
        <IconMore size={22} aria-hidden />
      </button>
      {open && (
        <MenuPanel leaving={leaving} label="Действия с учеником" className={`w-60 ${boxed ? 'left-0 top-12 origin-top-left' : 'right-0 top-12 origin-top-right'}`}>
          {actions.map((a) => (
            <MenuItem
              key={a}
              Icon={ACTION_ICON[a]}
              onSelect={() => {
                close()
                onPick(a)
              }}
            >
              {ACTION_LABEL[a]}
            </MenuItem>
          ))}
        </MenuPanel>
      )}
    </div>
  )
}
