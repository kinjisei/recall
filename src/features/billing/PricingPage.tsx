// ============================================================================
// «Тарифы» (роут /pricing) — публичная страница, работает и без входа
// (ссылка со страницы входа/настроек). Показывает статичные карточки тарифов
// из domains/billing и, если пользователь вошёл, плашку с его текущим
// тарифом. Оплата — на «Как оплатить» (/pay): реквизиты и «Оплата
// отправлена» только вошедшему — тариф включается на аккаунт.
// ============================================================================
import { useEffect, useState } from 'react'
import { IconCheck, IconTeacher, IconTrophy } from '../../shared/ui/icons'
import { BackButton } from '../../shared/ui/BackButton'
import { AppLink } from '../../shared/ui/AppLink'
import { OpenPage } from '../../shared/ui/OpenPage'
import { useAuth } from '../../context/AuthContext'
import { PLANS, getMyPlan, type MyPlan, type PlanCard } from '../../lib/billing'
import { energyLeft } from '../../components/EnergyBar'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function MyPlanBanner({ plan }: { plan: MyPlan }) {
  const planTitle = PLANS.find((p) => p.id === plan.plan)?.title ?? plan.plan

  const e = energyLeft(plan)
  const energyBit = e ? `энергия ${e.left}/${e.cap} ⚡` : null
  let statusLine: string
  if (plan.trial_until && new Date(plan.trial_until) > new Date()) {
    statusLine = `Пробный период до ${formatDate(plan.trial_until)}${energyBit ? ` · ${energyBit}` : ''}`
  } else if (plan.plan_expires_at) {
    statusLine = `действует до ${formatDate(plan.plan_expires_at)}${energyBit ? ` · ${energyBit}` : ''}`
  } else if (energyBit) {
    statusLine = `Энергия сегодня: ${e!.left} из ${e!.cap} ⚡`
  } else {
    statusLine = 'активен'
  }

  return (
    <div className="animate-fade-up flex items-center gap-3 rounded-2xl border border-accent-line bg-accent-soft p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-line text-accent-soft-fg">
        <IconTrophy size={18} />
      </div>
      <p className="text-sm text-accent-soft-fg">
        Твой тариф: <span className="font-medium">{planTitle}</span> · {statusLine}
      </p>
    </div>
  )
}

function Feature({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2 text-sm text-fg-secondary">
      <span className="mt-0.5 text-accent-strong">
        <IconCheck size={14} />
      </span>
      {children}
    </li>
  )
}

function Price({ price }: { price: number }) {
  if (price === 0) {
    return <p className="text-2xl font-medium">Бесплатно</p>
  }
  return (
    <p className="text-2xl font-medium">
      {price.toLocaleString('ru-RU')} ₸<span className="text-sm font-normal text-fg-muted"> /мес</span>
    </p>
  )
}

/** Ссылка-кнопка в духе Button secondary: ведёт по адресу, а не жмёт действие. */
const LINK_BUTTON =
  'lift inline-flex min-h-11 items-center justify-center rounded-xl border border-accent-line bg-accent-soft px-4 text-sm font-medium text-accent-soft-fg'

function PlanCardView({ plan, canPay }: { plan: PlanCard; canPay: boolean }) {
  return (
    <div className="animate-fade-up rounded-2xl border border-tint/[0.08] bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{plan.title}</h3>
        {plan.studentLimit && (
          <span className="rounded-full bg-tint/[0.06] px-2.5 py-1 text-xs text-fg-muted">
            до {plan.studentLimit} учеников
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-fg-muted">{plan.tagline}</p>
      <div className="mt-3">
        <Price price={plan.price} />
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {plan.features.map((f) => (
          <Feature key={f}>{f}</Feature>
        ))}
      </ul>
      {canPay && plan.price > 0 && (
        <AppLink to={`/pay?plan=${plan.id}`} className={`mt-4 ${LINK_BUTTON}`}>
          Оплатить
        </AppLink>
      )}
    </div>
  )
}

export function PricingPage() {
  const { user } = useAuth()
  const [myPlan, setMyPlan] = useState<MyPlan | null>(null)

  useEffect(() => {
    if (!user) return
    getMyPlan().then(setMyPlan)
  }, [user])

  const teacherPlans = PLANS.filter((p) => p.id.startsWith('teacher_'))
  const soloPlans = PLANS.filter((p) => !p.id.startsWith('teacher_'))

  return (
    // гостю — своя рамка на весь экран, вошедшему — общая рамка с меню
    <OpenPage>
      <div className="mb-5">
        <BackButton fallback={user ? '/' : '/login'} />
      </div>

      <h1 className="text-2xl font-medium tracking-tight">Тарифы</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Слова, тексты и грамматика бесплатны без срока. Платишь за энергию ⚡ на AI, а репетитор — ещё за места учеников и генерации материалов.
      </p>

      {myPlan && (
        <div className="mt-5">
          <MyPlanBanner plan={myPlan} />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {soloPlans.map((p) => (
          <PlanCardView key={p.id} plan={p} canPay={!!user} />
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2">
        <IconTeacher size={18} className="text-fg-muted" />
        <h2 className="font-medium">Для преподавателя</h2>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {teacherPlans.map((p) => (
          <PlanCardView key={p.id} plan={p} canPay={!!user} />
        ))}
      </div>

      <section className="animate-fade-up mt-8 rounded-2xl border border-tint/[0.08] bg-surface p-4 shadow-card">
        <h2 className="font-medium">Как оплатить</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
          Платишь переводом на Kaspi Gold: выбираешь тариф, переводишь и
          нажимаешь «Оплата отправлена». Мы сверяем перевод и включаем тариф,
          обычно в тот же день; если переведёшь ночью — утром. Карту мы не
          привязываем и сами ничего не списываем: чтобы продлить тариф, переведи
          ещё раз. Платишь до конца пробного периода или текущего тарифа — новый
          срок начнётся, когда они закончатся, ни один день не сгорит.
        </p>
        {/* тариф включается на аккаунт: реквизиты — тому, кто вошёл */}
        <AppLink to={user ? '/pay' : '/login'} className={`mt-3 ${LINK_BUTTON}`}>
          {user ? 'Как оплатить' : 'Войти, чтобы оплатить'}
        </AppLink>
        <p className="mt-3 text-sm leading-relaxed text-fg-secondary">
          Первые 14 дней после регистрации — пробный период, открыто всё, карта
          не нужна. Энергии первые три дня столько же, сколько на Premium, —
          30 ⚡ в день, дальше 15 ⚡. Реплика в «Диалоге», ход в квесте и разбор
          фрагмента текста стоят по 1 ⚡, проверка письма — 2 ⚡. Целый текст
          разбирается кусками по 1 ⚡, и цену видно до запуска. Переводы слов по
          тапу и произношение энергию не тратят, на пробном периоде их по 150 в
          день. Повторение карточек, игры и грамматика ничем не ограничены.
          Репетитору на пробном периоде дают 2 генерации — ровно на один
          материал, чтобы увидеть качество. С первым учеником их становится 3 в
          месяц.
        </p>
      </section>
    </OpenPage>
  )
}
