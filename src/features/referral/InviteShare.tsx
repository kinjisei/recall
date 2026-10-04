// ============================================================================
// Ссылка-приглашение и «поделиться» (макет t8-2): поле со ссылкой и
// «Скопировать», WhatsApp · Telegram · «Ещё…» (системное «Поделиться»), а под
// ними — сообщение так, как его увидит коллега.
//
// Отправляет сам репетитор со своего номера (журнал п.23): это ручное
// сообщение, не рассылка. Ссылки собирает shared/lib/share; текст — один, в
// domains/billing/referral.ts. «Ещё…» есть только там, где браузер умеет
// системное «Поделиться».
// ============================================================================
import { useState } from 'react'
import { Button } from '../../shared/ui/Button'
import { IconCheck, IconCopy, IconShare } from '../../shared/ui/icons'
import { SHARE_BUTTON, ShareLink } from '../../shared/ui/ShareLink'
import { useCopy } from '../../shared/lib/useCopy'
import { shareNative, telegramLink, whatsappLink } from '../../shared/lib/share'
import { INVITE_TEXT, inviteMessage, referralLink } from '../../domains/billing'
import { track } from '../../lib/analytics'

const canShareNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

export function InviteShare({ code }: { code: string }) {
  const link = referralLink(window.location.origin, code)
  const message = inviteMessage(link)
  const { copied, copy } = useCopy()
  // буфер недоступен — подсказать выделить и скопировать руками
  const [failed, setFailed] = useState(false)

  const copyLink = async () => {
    const ok = await copy('link', link)
    setFailed(!ok)
    if (ok) void track('referral_share', { via: 'copy' })
  }
  const shareMore = async () => {
    const r = await shareNative(INVITE_TEXT, link)
    if (r === 'shared') void track('referral_share', { via: 'native' })
    // системное окно не открылось — скопировать сообщение целиком
    if (r === 'unsupported') setFailed(!(await copy('message', message)))
  }

  return (
    <>
      <section>
        <h2 className="mb-2 text-sm text-fg-muted">Твоя ссылка</h2>
        <div className="flex items-center gap-2 rounded-2xl border border-tint/[0.08] bg-input p-1.5 pl-4">
          {/* ссылка выделяется целиком — если буфер недоступен, копируют руками */}
          <span className="min-w-0 flex-1 select-all truncate text-sm text-fg" data-referral-link={link}>
            {link.replace(/^https?:\/\//, '')}
          </span>
          <Button variant="secondary" className="min-h-11 flex-none px-3 text-sm" onClick={copyLink}>
            {copied === 'link' ? <IconCheck size={16} /> : <IconCopy size={16} />}
            {copied === 'link' ? 'Скопировано' : 'Скопировать'}
          </Button>
        </div>
        {failed && <p className="mt-2 text-note text-fg-muted">Не получилось скопировать — выдели ссылку и скопируй вручную.</p>}
        {copied === 'message' && <p className="mt-2 text-note text-fg-muted">Сообщение скопировано — вставь его, куда удобно.</p>}

        <div className={`mt-3 grid gap-2 ${canShareNative ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <ShareLink
            channel="whatsapp"
            href={whatsappLink(message)}
            onClick={() => void track('referral_share', { via: 'whatsapp' })}
          />
          <ShareLink
            channel="telegram"
            href={telegramLink(INVITE_TEXT, link)}
            onClick={() => void track('referral_share', { via: 'telegram' })}
          />
          {canShareNative && (
            <button type="button" className={SHARE_BUTTON} onClick={shareMore}>
              <IconShare size={18} /> Ещё…
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm text-fg-muted">Так увидит коллега</h2>
        <p className="whitespace-pre-line break-words rounded-2xl bg-input px-4 py-3 text-sm leading-relaxed text-fg-secondary" data-referral-message>
          {message}
        </p>
      </section>
    </>
  )
}
