// ============================================================================
// «Напишите нам» — три кнопки связи: WhatsApp, Telegram, почта (журнал п.71).
// Один блок на все экраны помощи: лендинг, тарифы, «Как оплатить», «Забыли
// пароль» и смена пароля, Настройки, экран сбоя. Подпись над блоком — у
// экрана. Номер на странице текстом не печатается, только в ссылке
// (shared/lib/contacts). Цвет — как у кнопок «поделиться» (ShareLink), но
// иконка над подписью: в строку три кнопки не влезали в карточку входа на
// 360 px — иконки сплющивались до нуля.
// ============================================================================
import { supportMailto, supportTelegram, supportWhatsapp } from '../lib/contacts'
import { IconDialog, IconMail, IconSend } from './icons'
import { SHARE_OUTLINE } from './ShareLink'

/** Только значок, квадрат 52 (лендинг d15): имя — для чтения с экрана и подсказкой при наведении. */
const CONTACT_ICON =
  'lift flex size-13 flex-none items-center justify-center rounded-control bg-surface text-accent-strong inset-ring inset-ring-line active:bg-row-press'

const CONTACT_BUTTON =
  'lift flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl bg-accent-soft px-1 py-2 text-note font-semibold text-accent-soft-fg'

export function ContactLinks({
  subject,
  inline = false,
  icons = false,
  className = '',
}: {
  /** Тема письма — видно, с какого экрана пишут. */
  subject?: string
  /** Кнопками-контуром в строку, значок слева (компьютер: «Как оплатить» d13, Настройки d14). */
  inline?: boolean
  /** Одни значки в строку (лендинг d15): рядом заголовок «Вопросы по проекту — напишите нам». */
  icons?: boolean
  className?: string
}) {
  const links = [
    { id: 'whatsapp', label: 'WhatsApp', href: supportWhatsapp(), Icon: IconDialog, external: true },
    { id: 'telegram', label: 'Telegram', href: supportTelegram(), Icon: IconSend, external: true },
    { id: 'email', label: 'Почта', href: supportMailto(subject), Icon: IconMail, external: false },
  ]
  return (
    <div className={`flex ${icons ? 'gap-2.5' : 'gap-2'} ${inline || icons ? 'flex-wrap' : 'w-full'} ${className}`}>
      {links.map(({ id, label, href, Icon, external }) => (
        <a
          key={id}
          href={href}
          data-contact={id}
          aria-label={icons ? label : undefined}
          title={icons ? label : undefined}
          className={icons ? CONTACT_ICON : inline ? SHARE_OUTLINE : CONTACT_BUTTON}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          <Icon size={icons ? 22 : 20} className="flex-none" aria-hidden />
          {!icons && label}
        </a>
      ))}
    </div>
  )
}
