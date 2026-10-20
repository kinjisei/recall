// ============================================================================
// Кружок с инициалом → меню: прогресс, ученики (у преподавателя), выход.
// У репетитора на пробном под именем — «Пробный · осталось N дней» (макет
// t9-1, PLAN.md Ф2.2), а «Тариф» ведёт сразу на «Как оплатить».
// Раньше вёл только на прогресс, а вход в режим преподавателя был лишь
// карточкой внизу Главной — теперь всё «служебное» собрано в одном месте.
//
// Вид — по месту в каркасе (макеты s4, d4-v2, d2): аватар 36 в шапке телефона
// (меню вниз); карточка с именем и строкой под ним внизу меню 240 (меню вверх):
// ученику — «Английский · B1», репетитору — тариф и срок или пробный; аватар в
// рельсе 72 (меню вправо). Аватар — общий (shared/ui/Avatar). Меню
// раскрывается из аватара — scale .96 → 1 и прозрачность за 180 мс, угол у
// аватара — точка роста; уходит обратно за 140 мс (лист s4, «Движение»).
// ============================================================================
import { useEffect, useState } from 'react'
import { IconChart, IconTeacher, IconGear, IconSignOut, IconCards, IconBadgeCheck, IconThumbsUp } from '../../shared/ui/icons'
import { FeedbackSheet } from '../../components/FeedbackSheet'
import { AppLink } from '../../shared/ui/AppLink'
import { getMyPlan, type MyPlan } from '../../lib/billing'
import { dayLabel, planNow, planShortTitle, teacherTrialStatus } from '../../domains/billing'
import { plural } from '../../shared/lib/plural'
import { IconTimer } from '../../shared/ui/icons'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { getEsLevel } from '../../lib/esLevel'
import { getCachedEnLevel } from '../../lib/profile'
import { Avatar } from '../../shared/ui/Avatar'
import { HoverTip } from '../../shared/ui/HoverTip'
import { useMenu } from '../../shared/ui/Menu'
import { useMyRole } from './useMyRole'

type Variant = 'circle' | 'row' | 'rail'
/** Куда раскрывается меню: из шапки — вниз, из карточки — вверх, из рельса — вправо. */
const MENU_AT: Record<Variant, string> = {
  circle: 'right-0 top-11 origin-top-right',
  row: 'bottom-full left-0 mb-2 origin-bottom-left',
  rail: 'bottom-0 left-full ml-3 origin-bottom-left',
}

export function AvatarMenu({ variant = 'circle' }: { variant?: Variant }) {
  const { user, signOut } = useAuth()
  const { lang } = useLanguage()
  // открыть, уйти анимацией к аватару, закрыть кликом мимо и Escape — общее меню (shared/ui/Menu)
  const { open, leaving, close: leave, toggle, box } = useMenu()
  const [feedback, setFeedback] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [plan, setPlan] = useState<MyPlan | null>(null)

  const name = (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? '?'
  // в карточке меню — имя, как в макетах d4-v2 и d2; полностью — в самом меню
  const firstName = name.trim().split(/\s+/)[0] || name

  // роль — общим хуком каркаса: перечитывается после смены роли (стал
  // репетитором — «Тариф» и метка пробного без перезагрузки)
  const isTeacher = useMyRole() === 'teacher'

  useEffect(() => {
    if (!user) return
    // пункт «Админка» — только владельцу; это лишь видимость ссылки,
    // настоящая защита в БД (is_admin проверяют сами RPC)
    getMyPlan().then((p) => {
      setIsAdmin(!!p?.is_admin)
      setPlan(p)
    })
  }, [user])

  // при открытии меню перепроверяем план: если запрос при старте не прошёл
  // (сеть моргнула), «Админка» иначе не появится до перезагрузки
  useEffect(() => {
    if (!open || isAdmin) return
    getMyPlan().then((p) => {
      setIsAdmin(!!p?.is_admin)
      if (p) setPlan(p)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const trial = isTeacher && plan ? teacherTrialStatus(plan) : null
  const trialText = !trial
    ? null
    : trial.kind === 'before_first'
      ? `Пробный · ${trial.days} ${plural(trial.days, 'день', 'дня', 'дней')} с первого ученика`
      : trial.days === 0
        ? 'Пробный · последний день'
        : `Пробный · осталось ${trial.days} ${plural(trial.days, 'день', 'дня', 'дней')}`
  const paidTeacher = !!plan?.plan.startsWith('teacher_') && !!plan.plan_expires_at && new Date(plan.plan_expires_at) > new Date()
  // строка под именем в карточке меню 240 (макеты d4-v2, d2)
  const now = plan ? planNow(plan) : null
  const level = lang === 'es' ? getEsLevel() : (getCachedEnLevel() ?? null)
  const line = isTeacher
    ? (trialText ?? (now?.kind === 'paid' ? `${planShortTitle(now.plan)} · до ${dayLabel(now.until)}` : null))
    : `${lang === 'es' ? 'Испанский' : 'Английский'}${level ? ` · ${level}` : ''}`

  const itemCls =
    'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-fg-secondary hover:bg-row-press hover:text-fg active:bg-row-press'

  return (
    <div className="relative" ref={box}>
      {variant === 'row' ? (
        <button
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Меню профиля"
          data-profile-card
          className="flex w-full items-center gap-2.5 rounded-2xl border border-line p-2 text-left transition-colors hover:bg-row-press active:bg-row-press"
        >
          <Avatar name={name} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-semibold text-fg">{firstName}</span>
            {line && <span className="block truncate text-xs text-fg-muted">{line}</span>}
          </span>
        </button>
      ) : (
        <button
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Меню профиля"
          className="group relative flex size-11 items-center justify-center rounded-full transition-colors active:bg-ghost-press"
        >
          <Avatar name={name} size={36} />
          {variant === 'rail' && !open && <HoverTip label={firstName} />}
        </button>
      )}

      {open && (
        <div
          role="menu"
          className={`${leaving ? 'animate-menu-out' : 'animate-menu-in'} absolute z-30 w-56 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-raised ${MENU_AT[variant]}`}
        >
          <p className="truncate px-4 pb-2 pt-1.5 text-xs text-fg-muted">{name}</p>
          {trialText && (
            <p className="mx-4 mb-2 flex items-start gap-1.5 rounded-lg bg-tint/[0.06] px-2.5 py-1.5 text-caption leading-snug text-fg-secondary" data-trial>
              <IconTimer size={13} className="mt-px flex-none" /> <span>{trialText}</span>
            </p>
          )}
          <AppLink to="/progress" role="menuitem" className={itemCls} onClick={leave}>
            <IconChart size={17} /> Мой прогресс
          </AppLink>
          {/* не-преподавателю — вход в режим: до A1 попасть в студию
              самостоятельно было нельзя вообще, роль выдавалась вручную SQL-ом.
              У репетитора студия — вкладки меню (Ф2.10, макет t1-2), пункт
              здесь повторял бы вкладку «Ученики». */}
          {!isTeacher && (
            <AppLink to="/teacher" role="menuitem" className={itemCls} onClick={leave}>
              <IconTeacher size={17} /> Я веду учеников
            </AppLink>
          )}
          {/* репетитору — сразу «Как оплатить» (макет t9-1), остальным — тарифы */}
          {isTeacher ? (
            <AppLink to="/pay" role="menuitem" className={itemCls} onClick={leave}>
              <IconCards size={17} /> Тариф
              {!paidTeacher && <span className="ml-auto text-xs font-medium text-accent-strong">Выбрать</span>}
            </AppLink>
          ) : (
            <AppLink to="/pricing" role="menuitem" className={itemCls} onClick={leave}>
              <IconCards size={17} /> Тарифы
            </AppLink>
          )}
          <AppLink to="/settings" role="menuitem" className={itemCls} onClick={leave}>
            <IconGear size={17} /> Настройки
          </AppLink>
          {/* Отзыв — прямо в меню: до этого сообщить нам что-либо было НЕЧЕМ,
              и человек, которому что-то мешало, просто уходил молча. */}
          <button
            role="menuitem"
            onClick={() => {
              leave()
              setFeedback(true)
            }}
            className={itemCls}
          >
            <IconThumbsUp size={17} /> Оставить отзыв
          </button>
          {isAdmin && (
            <AppLink to="/admin" role="menuitem" className={itemCls} onClick={leave}>
              <IconBadgeCheck size={17} /> Админка
            </AppLink>
          )}
          <button role="menuitem" onClick={() => void signOut()} className={itemCls}>
            <IconSignOut size={17} /> Выйти
          </button>
        </div>
      )}
      {feedback && <FeedbackSheet where="menu" onClose={() => setFeedback(false)} />}
    </div>
  )
}
