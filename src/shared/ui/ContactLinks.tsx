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

const CONTACT_BUTTON =
  'lift flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl bg-accent-soft px-1 py-2 text-note font-semibold text-accent-soft-fg'

export function ContactLinks({
  subject,
  className = '',
}: {
  /** Тема письма — видно, с какого экрана пишут. */
  subject?: string
  className?: string
}) {
  const links = [
    { id: 'whatsapp', label: 'WhatsApp', href: supportWhatsapp(), Icon: IconDialog, external: true },
    { id: 'telegram', label: 'Telegram', href: supportTelegram(), Icon: IconSend, external: true },
    { id: 'email', label: 'Почта', href: supportMailto(subject), Icon: IconMail, external: false },
  ]
  return (
    <div className={`flex w-full gap-2 ${className}`}>
      {links.map(({ id, label, href, Icon, external }) => (
        <a
          key={id}
          href={href}
          data-contact={id}
          className={CONTACT_BUTTON}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          <Icon size={20} className="flex-none" aria-hidden />
          {label}
        </a>
      ))}
    </div>
  )
}
