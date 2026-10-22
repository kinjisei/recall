// ============================================================================
// Подарок-рефералка в каркасе (PLAN.md Ф2.3; журнал п.16, 35; макет t8-1):
// у репетитора на всех экранах — в шапке телефона рядом с колокольчиком и
// строкой внизу боковой панели компьютера. Ведёт на «Пригласи коллегу».
// Кому показывать, решает каркас (роль — app/shell/useMyRole).
//
// Разовая подсветка — после первой оплаты тарифа репетитора: кольцо вокруг
// подарка и подсказка рядом. Заметно, но без мигания; закрыл крестиком или
// нажал на подарок — больше не появится нигде (отметка в базе, не на
// устройстве). Других напоминаний нет (журнал п.16).
// ============================================================================
import { useEffect, useState } from 'react'
import { AppLink } from '../../shared/ui/AppLink'
import { HoverTip } from '../../shared/ui/HoverTip'
import { IconClose, IconGift } from '../../shared/ui/icons'
import { dismissReferralHint, loadReferralHint } from '../../domains/billing'
import { ICON_BUTTON } from '../../shared/ui/IconButton'

/** Подсветка проверяется при открытии и не чаще раза в 5 минут при возвращении в приложение. */
const RECHECK_MS = 5 * 60 * 1000

function useReferralHint(): [boolean, () => void] {
  const [hint, setHint] = useState(false)

  useEffect(() => {
    let alive = true
    let checkedAt = 0
    const check = () => {
      if (Date.now() - checkedAt < RECHECK_MS) return
      checkedAt = Date.now()
      loadReferralHint().then((v) => alive && setHint(v))
    }
    check()
    // оплату подтвердили, пока приложение было свёрнуто, — подсказка
    // появится при возвращении, без перезагрузки
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const dismiss = () => {
    setHint(false)
    // не дошло — подсказка вернётся при следующем открытии; это не поломка
    dismissReferralHint().catch(() => {})
  }
  return [hint, dismiss]
}

// в меню — сбоку, поверх страницы: вверх подсказка ложилась на строку
// «Уведомления» над подарком (меню d0, Ф2.17-1), и после первой оплаты
// «Оплата получена» было не открыть, пока не закроешь подсказку
const HINT_AT = {
  below: 'right-0 top-full mt-2',
  side: 'bottom-0 left-full ml-3',
} as const

function Hint({ onClose, placement }: { onClose: () => void; placement: keyof typeof HINT_AT }) {
  return (
    <div
      role="status"
      className={`animate-fade-up absolute z-40 flex w-64 items-start gap-2 rounded-2xl border border-accent-line bg-surface p-3 text-sm text-fg-secondary shadow-raised ${HINT_AT[placement]}`}
    >
      <p className="flex-1 leading-snug">
        <b className="font-medium text-fg">Подарок за коллег.</b> Пригласи коллегу: за его первую оплату к твоему тарифу
        добавится месяц бесплатно.
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть подсказку"
        className="-m-1 flex h-8 w-8 flex-none items-center justify-center rounded-full text-fg-muted hover:text-fg"
      >
        <IconClose size={16} />
      </button>
    </div>
  )
}

/**
 * icon — круглая кнопка в шапке телефона (подсказка вниз); row — строка
 * «Пригласить коллегу» в меню 240; rail — иконка в рельсе 72 с подписью при
 * наведении (в меню подсказка — вправо, за край меню). Макеты s4, d0.
 */
export function GiftButton({ variant = 'icon' }: { variant?: 'icon' | 'row' | 'rail' }) {
  const [hint, dismiss] = useReferralHint()
  // подпись пункта меню — «Пригласить», как в макетах меню (s4, d2, d13;
  // решение владельца 19.10.2026); экран, куда он ведёт, — «Пригласи коллегу»
  const label = 'Пригласить коллегу'

  return (
    // data-gift — для смоука: подарок есть и подсвечен ли он
    <div className="relative" data-gift={hint ? 'hint' : 'plain'}>
      {variant === 'icon' ? (
        <AppLink
          to="/invite"
          onClick={() => hint && dismiss()}
          aria-label={label}
          className={`${ICON_BUTTON} ${hint ? 'text-accent-strong! ring-2 ring-accent-line' : ''}`}
        >
          <IconGift size={24} />
        </AppLink>
      ) : variant === 'rail' ? (
        <AppLink
          to="/invite"
          onClick={() => hint && dismiss()}
          aria-label={label}
          className={`group relative flex size-12 items-center justify-center rounded-2xl border transition-colors hover:bg-tint/[0.06] ${
            hint ? 'border-accent-line text-accent-strong' : 'border-transparent text-fg-muted hover:text-fg-secondary'
          }`}
        >
          <IconGift size={22} />
          <HoverTip label={label} />
        </AppLink>
      ) : (
        <AppLink
          to="/invite"
          onClick={() => hint && dismiss()}
          className={`flex h-11 items-center gap-3 rounded-2xl border px-3 text-body font-semibold transition-colors ${
            hint ? 'border-accent-line text-accent-strong' : 'border-transparent text-fg-secondary hover:text-fg'
          }`}
        >
          <IconGift size={22} />
          <span>{label}</span>
        </AppLink>
      )}
      {hint && <Hint onClose={dismiss} placement={variant === 'icon' ? 'below' : 'side'} />}
    </div>
  )
}
