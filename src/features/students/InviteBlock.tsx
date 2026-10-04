// ============================================================================
// «Пригласить в Recall» (макет t6-4) — у карточки без приложения. Код карточки
// (6 знаков) и ссылка с ним: ученик откроет ссылку или введёт код в поле
// «Код преподавателя» и попадёт ровно в эту карточку (domains/students).
// Отправляет сам учитель со своего номера (журнал п.23): WhatsApp — сразу на
// номер ученика, если он записан; Telegram — выбор получателя; «Ссылка» —
// скопировать. Под кнопками — займёт ли ученик место тарифа.
// ============================================================================
import { useState } from 'react'
import {
  cardInviteLink,
  cardInviteMessage,
  cardInviteText,
  contactLinks,
  firstName,
  inviteSeatHint,
  loadCardInvite,
  spacedCode,
  type SeatsState,
  type StudentCard,
} from '../../domains/students'
import { telegramLink, whatsappLink } from '../../shared/lib/share'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { useCopy } from '../../shared/lib/useCopy'
import { IconCheck, IconCopy, IconShare } from '../../shared/ui/icons'
import { SHARE_BUTTON, ShareLink } from '../../shared/ui/ShareLink'
import { LoadError } from '../../shared/ui/LoadError'
import { track } from '../../lib/analytics'

export function InviteBlock({ card, seats }: { card: StudentCard; seats: SeatsState | null }) {
  const { data: code, error, loading, reload } = useAsyncData(
    () => loadCardInvite(card.id),
    [card.id],
    'Не удалось получить код приглашения',
  )
  const hint = inviteSeatHint(card, seats)

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border border-accent-line bg-surface p-5 shadow-card"
      data-card-invite
    >
      <h3 className="flex items-center gap-2 font-semibold">
        <IconShare size={18} className="text-accent-strong" /> Пригласить в Recall
      </h3>
      <p className="text-sm text-fg-secondary">
        {firstName(card.name)} пока не в Recall. Когда войдёт, будет получать от тебя домашку и
        задания, а ты — видеть, как идут занятия.
      </p>

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : loading || !code ? (
        <div className="h-24 animate-pulse rounded-xl bg-tint/[0.05]" />
      ) : (
        <Ready card={card} code={code} />
      )}

      {hint && <p className="text-xs text-fg-muted">ⓘ {hint}</p>}
    </section>
  )
}

function Ready({ card, code }: { card: StudentCard; code: string }) {
  const { copied, copy } = useCopy()
  // буфер недоступен — подсказать выделить и скопировать руками
  const [failed, setFailed] = useState(false)
  const link = cardInviteLink(window.location.origin, code)
  const message = cardInviteMessage(card.name, code, link)
  const phone = contactLinks(card.contact).whatsapp ? card.contact : null

  const copyLink = async () => {
    const ok = await copy('link', link)
    setFailed(!ok)
    if (ok) void track('card_invite_share', { via: 'copy' })
  }

  return (
    <>
      <p
        className="whitespace-pre-line break-words rounded-xl bg-input px-4 py-3 text-sm leading-relaxed text-fg-secondary"
        data-invite-message
      >
        {message}
      </p>
      <p className="text-sm text-fg-muted">
        Код для ученика: <span className="font-mono text-base font-bold tracking-widest text-fg" data-invite-code={code}>{spacedCode(code)}</span>
      </p>
      <div className="flex gap-2">
        <ShareLink
          channel="whatsapp"
          href={whatsappLink(message, phone)}
          onClick={() => void track('card_invite_share', { via: 'whatsapp' })}
        />
        <ShareLink
          channel="telegram"
          href={telegramLink(cardInviteText(card.name, code), link)}
          onClick={() => void track('card_invite_share', { via: 'telegram' })}
        />
        <button type="button" className={SHARE_BUTTON} onClick={copyLink}>
          {copied === 'link' ? <IconCheck size={18} /> : <IconCopy size={18} />}
          {copied === 'link' ? 'Готово' : 'Ссылка'}
        </button>
      </div>
      {failed && (
        <p className="text-xs text-fg-muted">Не получилось скопировать — выдели сообщение и скопируй вручную.</p>
      )}
    </>
  )
}
