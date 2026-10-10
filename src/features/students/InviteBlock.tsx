// ============================================================================
// «Пригласить в Recall» (макет t6-4) — у карточки без приложения. Код карточки
// (6 знаков) и ссылка с ним: ученик откроет ссылку или введёт код в поле
// «Код преподавателя» и попадёт ровно в эту карточку (domains/students).
// Отправляет сам учитель со своего номера (журнал п.23): WhatsApp — сразу на
// номер ученика, если он записан; Telegram — выбор получателя; «Ссылка» —
// скопировать. Под кнопками — займёт ли ученик место тарифа.
//
// Сообщение — от учителя, про домашку и практику (журнал п.71, 6), язык
// разговора с AI — тот, что учитель преподаёт (EN/ES в шапке). Те же кнопки
// и то же сообщение без имени — у общего кода (GeneralInvite).
// ============================================================================
import { useState } from 'react'
import {
  cardInviteLink,
  contactLinks,
  firstName,
  inviteMessage,
  inviteSeatHint,
  inviteTelegramText,
  loadCardInvite,
  spacedCode,
  type SeatsState,
  type StudentCard,
} from '../../domains/students'
import { useLanguage } from '../../context/LanguageContext'
import { telegramLink, whatsappLink } from '../../shared/lib/share'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { useCopy } from '../../shared/lib/useCopy'
import { IconCheck, IconCopy, IconShare } from '../../shared/ui/icons'
import { SHARE_BUTTON, SHARE_ROW, ShareLink } from '../../shared/ui/ShareLink'
import { LoadError } from '../../shared/ui/LoadError'
import { track } from '../../lib/analytics'

export function InviteBlock({ card, seats }: { card: StudentCard; seats: SeatsState | null }) {
  const { data: code, error, loading, reload } = useAsyncData(
    () => loadCardInvite(card.id),
    [card.id],
    'Не удалось получить код приглашения',
  )
  const hint = inviteSeatHint(card, seats)
  const name = firstName(card.name)

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border border-accent-line bg-surface p-4 shadow-card"
      data-card-invite
    >
      <h3 className="flex items-center gap-2 font-semibold">
        <IconShare size={18} className="text-accent-strong" /> Пригласить в Recall
      </h3>
      {/* польза для учителя — то, ради чего стоит отправить */}
      <p className="text-sm text-fg-secondary">
        {name} пока не в Recall. Когда войдёт, задания будут проверяться сразу, а ты увидишь, что
        сделано между уроками и где нужна помощь.
      </p>

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : loading || !code ? (
        <div className="h-24 animate-pulse rounded-xl bg-tint/[0.05]" />
      ) : (
        <InviteShare name={card.name} code={code} phone={contactLinks(card.contact).whatsapp ? card.contact : null} event="card_invite_share" />
      )}

      {hint && <p className="text-xs text-fg-muted">ⓘ {hint}</p>}
    </section>
  )
}

/**
 * Сообщение и кнопки «поделиться»: личный код карточки (name — имя ученика)
 * или общий код (name = null). Ссылка подставляет код в поле «Код
 * преподавателя» — оба кода оно принимает одинаково.
 */
export function InviteShare({
  name,
  code,
  phone = null,
  event,
}: {
  name: string | null
  code: string
  /** Номер ученика — WhatsApp откроется сразу на нём. */
  phone?: string | null
  /** Событие аналитики: какой код отправили. */
  event: 'card_invite_share' | 'general_invite_share'
}) {
  const { lang } = useLanguage()
  const { copied, copy } = useCopy()
  // буфер недоступен — подсказать выделить и скопировать руками
  const [failed, setFailed] = useState(false)
  const link = cardInviteLink(window.location.origin, code)
  const message = inviteMessage(name, code, link, lang)

  const copyLink = async () => {
    const ok = await copy('link', link)
    setFailed(!ok)
    if (ok) void track(event, { via: 'copy' })
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
      <div className={SHARE_ROW}>
        <ShareLink channel="whatsapp" href={whatsappLink(message, phone)} onClick={() => void track(event, { via: 'whatsapp' })} />
        <ShareLink
          channel="telegram"
          href={telegramLink(inviteTelegramText(name, code, lang), link)}
          onClick={() => void track(event, { via: 'telegram' })}
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
