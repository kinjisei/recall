// ============================================================================
// «Сообщи ученику» после переноса или отмены и «Напомнить об уроке» (макет
// t5-4; журнал п.38, 42, 68). Recall ученику без приложения не пишет никогда —
// учитель пересылает сам, со своего номера. Ученику в приложении Recall пишет
// сам (Ф2.9), поэтому здесь он только с выключенными уведомлениями: ленту
// увидит, лишь открыв приложение. WhatsApp — сразу на номер из карточки.
// ============================================================================
import { contactLinks } from '../../domains/students'
import { useCopy } from '../../shared/lib/useCopy'
import { telegramLink, whatsappLink } from '../../shared/lib/share'
import { Button } from '../../shared/ui/Button'
import { IconCheck, IconClose, IconCopy, IconSmartphoneOff } from '../../shared/ui/icons'
import { SHARE_BUTTON, ShareLink } from '../../shared/ui/ShareLink'
import { Sheet, SHEET_BODY } from '../../shared/ui/Sheet'

export interface TellItem {
  cardId: string
  name: string
  contact: string | null
  inApp: boolean
  text: string
}

export interface Tell {
  title: string
  items: TellItem[]
  /** Ссылка в сообщении Telegram (у Telegram она обязательна): урок или Recall. */
  url: string
}

function Item({ item, url }: { item: TellItem; url: string }) {
  const { copied, copy } = useCopy()
  const phone = contactLinks(item.contact).whatsapp ? item.contact : null
  return (
    <li className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-sm text-fg-secondary">
        {!item.inApp && <IconSmartphoneOff size={16} aria-hidden className="flex-none text-fg-muted" />}
        {/* без падежей: «Тимура нет» правилом из любого имени не получить */}
        {item.inApp
          ? `${item.name} — уведомления в Recall выключены, напиши сам`
          : `${item.name} — без приложения, отправь сообщение сам`}
      </p>
      <p className="whitespace-pre-line break-words rounded-xl bg-input px-4 py-3 text-sm leading-relaxed text-fg" data-tell-message>
        {item.text}
      </p>
      <div className="flex gap-2">
        <ShareLink channel="whatsapp" href={whatsappLink(item.text, phone)} />
        <ShareLink channel="telegram" href={telegramLink(item.text, url)} />
        <button type="button" className={SHARE_BUTTON} onClick={() => void copy(item.cardId, item.text)}>
          {copied === item.cardId ? <IconCheck size={18} aria-hidden /> : <IconCopy size={18} aria-hidden />}
          {copied === item.cardId ? 'Готово' : 'Текст'}
        </button>
      </div>
    </li>
  )
}

export function TellSheet({ tell, onClose }: { tell: Tell; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} labelledBy="tell-title">
      <div className={SHEET_BODY}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="tell-title" className="text-lg font-semibold">
            {tell.title}
          </h2>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="flex size-11 flex-none items-center justify-center rounded-xl text-fg-muted hover:bg-tint/[0.06]">
            <IconClose size={20} />
          </button>
        </div>
        <ul className="flex flex-col gap-5">
          {tell.items.map((item) => (
            <Item key={item.cardId} item={item} url={tell.url} />
          ))}
        </ul>
        <Button className="w-full" onClick={onClose}>
          Готово
        </Button>
      </div>
    </Sheet>
  )
}
