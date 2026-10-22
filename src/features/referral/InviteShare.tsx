// ============================================================================
// Телефон: ссылка-приглашение и «поделиться» (макет t8-2; логика —
// useInviteShare, общая с компьютером d13-1): поле со ссылкой и
// «Скопировать», WhatsApp · Telegram · «Ещё…» (системное «Поделиться»), а под
// ними — сообщение так, как его увидит коллега.
//
// Отправляет сам репетитор со своего номера (журнал п.23): это ручное
// сообщение, не рассылка. Ссылки собирает shared/lib/share; текст — один, в
// domains/billing/referral.ts. «Ещё…» есть только там, где браузер умеет
// системное «Поделиться».
// ============================================================================
import { Button } from '../../shared/ui/Button'
import { IconCheck, IconCopy, IconShare } from '../../shared/ui/icons'
import { SHARE_BUTTON, ShareLink } from '../../shared/ui/ShareLink'
import { canShareNative, useInviteShare } from './useInviteShare'

export function InviteShare({ code }: { code: string }) {
  const { link, shown, message, whatsapp, telegram, copied, failed, copyLink, shareMore, tracked } = useInviteShare(code)

  return (
    <>
      <section>
        <h2 className="mb-2 text-sm text-fg-muted">Твоя ссылка</h2>
        <div className="flex items-center gap-2 rounded-2xl border border-tint/[0.08] bg-input p-1.5 pl-4">
          {/* ссылка выделяется целиком — если буфер недоступен, копируют руками */}
          <span className="min-w-0 flex-1 select-all truncate text-sm text-fg" data-referral-link={link}>
            {shown}
          </span>
          <Button size="sm" variant="secondary" className="flex-none" onClick={copyLink}>
            {copied === 'link' ? <IconCheck size={16} /> : <IconCopy size={16} />}
            {copied === 'link' ? 'Скопировано' : 'Скопировать'}
          </Button>
        </div>
        {failed && <p className="mt-2 text-note text-fg-muted">Не получилось скопировать — выдели ссылку и скопируй вручную.</p>}
        {copied === 'message' && <p className="mt-2 text-note text-fg-muted">Сообщение скопировано — вставь его, куда удобно.</p>}

        <div className={`@container mt-3 grid gap-2 ${canShareNative ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <ShareLink channel="whatsapp" href={whatsapp} onClick={tracked('whatsapp')} />
          <ShareLink channel="telegram" href={telegram} onClick={tracked('telegram')} />
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
