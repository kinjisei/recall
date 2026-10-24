// ============================================================================
// «Напомнить <имя>» об оплате (макет t7-3; журнал п.29): учитель напоминает
// сам — текстом, который можно поправить. Как: «В приложении» (ученик в
// Recall — придёт как сообщение от учителя), WhatsApp на номер из карточки,
// Telegram, «Напомню лично». Recall ученику об оплате сам не пишет никогда —
// это сказано внизу, чтобы учитель не ждал, что напомнит приложение.
// Набранное переживает перезагрузку (Ф1.14, useDraft): текст правят.
// ============================================================================
import { useState } from 'react'
import { paymentReminder, sendCardMessage } from '../../domains/schedule'
import { contactLinks, firstName, type StudentCard } from '../../domains/students'
import { useDraft } from '../../shared/lib/useDraft'
import { telegramLink, whatsappLink } from '../../shared/lib/share'
import { Button } from '../../shared/ui/Button'
import { DraftRestored } from '../../shared/ui/DraftRestored'
import { IconSmartphone } from '../../shared/ui/icons'
import { SHARE_ROW, ShareLink } from '../../shared/ui/ShareLink'
import { Sheet, SHEET_BODY } from '../../shared/ui/Sheet'
import { ErrorText } from '../../shared/ui/ErrorText'
import { SheetHeader } from '../../shared/ui/SheetHeader'
import { fieldClass } from '../../shared/ui/TextField'

export function RemindSheet({
  card,
  left,
  next,
  onClose,
  onSent,
}: {
  card: Pick<StudentCard, 'id' | 'name' | 'contact' | 'inApp'>
  /** Остаток сейчас: 1 — «остался один», 0 и меньше — «закончились». */
  left: number
  /** Ближайший урок (ISO) — в тексте «во вторник в 10:00». */
  next: string | null
  onClose: () => void
  /** Сообщение ушло в приложение. */
  onSent: () => void
}) {
  const who = firstName(card.name)
  const initial = paymentReminder(who, left, next)
  const [text, setText, draft] = useDraft(`remind-pay:${card.id}`, initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const phone = contactLinks(card.contact).whatsapp ? card.contact : null
  const message = text.trim() || initial

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      await sendCardMessage(card.id, message)
      draft.forget()
      onSent()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить')
      setBusy(false)
    }
  }
  const done = () => {
    draft.forget()
    onClose()
  }

  return (
    <Sheet onClose={onClose} labelledBy="remind-title">
      <SheetHeader id="remind-title" title={`Напомнить: ${card.name}`} />
      <div className={SHEET_BODY}>
        <label className="flex flex-col gap-1.5">
          <span className="text-note text-fg-muted">Текст — можно поправить</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={500}
            data-remind-text
            className={`${fieldClass()} py-3 leading-relaxed`}
          />
          {draft.restored && <DraftRestored onClear={draft.clear} />}
        </label>
        <section aria-label="Как напомнить" className="flex flex-col gap-2">
          <span className="text-note text-fg-muted">Как напомнить</span>
          {card.inApp && (
            <Button variant="secondary" className="w-full flex-col gap-0.5 py-2.5" loading={busy} onClick={() => void send()}>
              <span className="flex items-center gap-1.5">
                <IconSmartphone size={18} aria-hidden /> В приложении
              </span>
              <span className="text-caption font-normal text-fg-muted">Придёт в Recall как сообщение от тебя</span>
            </Button>
          )}
          <div className={SHARE_ROW}>
            <ShareLink channel="whatsapp" href={whatsappLink(message, phone)} onClick={() => draft.forget()} />
            <ShareLink channel="telegram" href={telegramLink(message, window.location.origin)} onClick={() => draft.forget()} />
          </div>
          <Button variant="ghost" className="w-full" onClick={done}>
            Напомню лично
          </Button>
        </section>
        {error && (
          <ErrorText>
            {error}
          </ErrorText>
        )}
        <p className="text-center text-note text-fg-muted">Recall сам ученику об оплате не пишет.</p>
      </div>
    </Sheet>
  )
}
