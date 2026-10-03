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
import { IconClose, IconGift } from '../../shared/ui/icons'
import { dismissReferralHint, loadReferralHint } from '../../domains/billing'

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

function Hint({ onClose, placement }: { onClose: () => void; placement: 'below' | 'above' }) {
  return (
    <div
      role="status"
      className={`animate-fade-up absolute z-40 flex w-64 items-start gap-2 rounded-2xl border border-accent-line bg-surface p-3 text-sm text-fg-secondary shadow-raised ${
        placement === 'below' ? 'right-0 top-full mt-2' : 'bottom-full left-0 mb-2'
      }`}
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
 * icon — круглая кнопка в шапке телефона (подсказка вниз); row — строка над
 * нижней полосой боковой панели компьютера (подсказка вверх): четвёртая
 * круглая кнопка рядом с аватаром, колокольчиком и EN/ES в 15rem не влезает.
 */
export function GiftButton({ variant = 'icon' }: { variant?: 'icon' | 'row' }) {
  const [hint, dismiss] = useReferralHint()
  const label = 'Пригласи коллегу'

  return (
    // data-gift — для смоука: подарок есть и подсвечен ли он
    <div className="relative" data-gift={hint ? 'hint' : 'plain'}>
      {variant === 'icon' ? (
        <AppLink
          to="/invite"
          onClick={() => hint && dismiss()}
          aria-label={label}
          className={`lift flex h-11 w-11 flex-none items-center justify-center rounded-full border bg-surface text-fg-secondary hover:text-fg ${
            hint ? 'border-accent text-accent-strong ring-2 ring-accent-line-soft' : 'border-tint/[0.08]'
          }`}
        >
          <IconGift size={20} />
        </AppLink>
      ) : (
        <AppLink
          to="/invite"
          onClick={() => hint && dismiss()}
          className={`flex h-11 items-center gap-3 rounded-2xl border px-3 text-sm font-medium transition-colors ${
            hint ? 'border-accent-line text-accent-strong' : 'border-transparent text-fg-muted hover:text-fg-secondary'
          }`}
        >
          <IconGift size={22} />
          <span>{label}</span>
        </AppLink>
      )}
      {hint && <Hint onClose={dismiss} placement={variant === 'icon' ? 'below' : 'above'} />}
    </div>
  )
}
