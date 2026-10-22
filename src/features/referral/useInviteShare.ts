// ============================================================================
// Ссылка-приглашение и «поделиться» — одна логика на телефон (t8-2,
// InviteShare) и компьютер (d13-1, InviteDesk): ссылка и сообщение коллеге,
// «Скопировать» (буфер недоступен — подсказать скопировать руками), «Ещё…»
// (системное «Поделиться»; не открылось — скопировать сообщение целиком) и
// счёт, откуда делились. Текст — один, в domains/billing/referral.ts.
// ============================================================================
import { useState } from 'react'
import { INVITE_TEXT, inviteMessage, referralLink } from '../../domains/billing'
import { track } from '../../lib/analytics'
import { shareNative, telegramLink, whatsappLink } from '../../shared/lib/share'
import { useCopy } from '../../shared/lib/useCopy'

export const canShareNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

export function useInviteShare(code: string) {
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

  return {
    link,
    /** Ссылка без https:// — так её видно в поле. */
    shown: link.replace(/^https?:\/\//, ''),
    message,
    whatsapp: whatsappLink(message),
    telegram: telegramLink(INVITE_TEXT, link),
    copied,
    failed,
    copyLink,
    shareMore,
    tracked: (via: 'whatsapp' | 'telegram') => () => void track('referral_share', { via }),
  }
}
