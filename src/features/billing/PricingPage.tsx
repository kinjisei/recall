// ============================================================================
// «Тарифы» (роут /pricing) — публичная страница, работает и без входа
// (ссылка со страницы входа/настроек). Показывает статичные карточки тарифов
// из lib/billing.ts и, если пользователь вошёл и RPC get_my_plan уже есть в
// БД, плашку с его текущим тарифом.
// ============================================================================
import { useEffect, useState } from 'react'
import { IconCheck, IconTeacher, IconTrophy } from '../../components/icons'
import { SmartBack } from '../../components/SmartBack'
import { useAuth } from '../../context/AuthContext'
import { PLANS, KASPI, getMyPlan, type MyPlan, type PlanCard } from '../../lib/billing'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function MyPlanBanner({ plan }: { plan: MyPlan }) {
  const planTitle = PLANS.find((p) => p.id === plan.plan)?.title ?? plan.plan

  let statusLine: string
  if (plan.trial_until && new Date(plan.trial_until) > new Date()) {
    statusLine = `Триал до ${formatDate(plan.trial_until)}`
  } else if (plan.plan_expires_at) {
    statusLine = `действует до ${formatDate(plan.plan_expires_at)}`
  } else if (plan.plan === 'free') {
    statusLine = `AI сегодня: ${plan.ai_used_today} из ${plan.ai_day_limit}`
  } else {
    statusLine = 'активен'
  }

  return (
    <div className="animate-fade-up flex items-center gap-3 rounded-2xl border border-[var(--night-accent-45)] bg-[var(--night-accent-900)] p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--night-accent-45)] text-[var(--night-accent-100)]">
        <IconTrophy size={18} />
      </div>
      <p className="text-sm text-[var(--night-accent-100)]">
        Твой тариф: <span className="font-medium">{planTitle}</span> · {statusLine}
      </p>
    </div>
  )
}

function Feature({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2 text-sm text-[var(--night-text-70)]">
      <span className="mt-0.5 text-[var(--night-accent-text)]">
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
      {price.toLocaleString('ru-RU')} ₸<span className="text-sm font-normal text-[var(--night-text-40)]"> /мес</span>
    </p>
  )
}

function PlanCardView({ plan }: { plan: PlanCard }) {
  return (
    <div className="animate-fade-up rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{plan.title}</h3>
        {plan.studentLimit && (
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-[var(--night-text-40)]">
            до {plan.studentLimit} учениц
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-[var(--night-text-40)]">{plan.tagline}</p>
      <div className="mt-3">
        <Price price={plan.price} />
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {plan.features.map((f) => (
          <Feature key={f}>{f}</Feature>
        ))}
      </ul>
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
    <main className="mx-auto min-h-[100dvh] max-w-screen-sm bg-[var(--night-bg)] px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1.5rem)] text-[var(--night-text)]">
      <SmartBack fallback={user ? '/' : '/login'} />

      <h1 className="text-2xl font-medium tracking-tight">Тарифы</h1>
      <p className="mt-1 text-sm text-[var(--night-text-40)]">
        Для репетитора — дешевле одного часа твоей работы в месяц
      </p>

      {myPlan && (
        <div className="mt-5">
          <MyPlanBanner plan={myPlan} />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {soloPlans.map((p) => (
          <PlanCardView key={p.id} plan={p} />
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2">
        <IconTeacher size={18} className="text-[var(--night-text-40)]" />
        <h2 className="font-medium">Для преподавателя</h2>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {teacherPlans.map((p) => (
          <PlanCardView key={p.id} plan={p} />
        ))}
      </div>

      <section className="animate-fade-up mt-8 rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] p-4">
        <h2 className="font-medium">Как оплатить</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--night-text-70)]">
          Переводом в Kaspi на номер{' '}
          <span className="font-medium text-[var(--night-text)]">{KASPI.phone}</span> (
          {KASPI.name}). В комментарии к переводу укажи email своего аккаунта — так мы поймём,
          кому включить тариф.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--night-text-70)]">
          Тариф включаем руками — обычно в тот же день. Если перевёл ночью, жди утра.
          Карту мы не привязываем и сами ничего не списываем: чтобы продлить, нужно
          перевести снова. Передумал — напиши в течение 14 дней, вернём за
          неиспользованные дни.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--night-text-70)]">
          Первые 14 дней после регистрации — пробный период: все разделы открыты,
          12 разговоров с AI в день. Разговор — это реплика в «Диалоге», проверка
          письма или ход в квесте. Перевод слов по тапу, произношение, повторение
          карточек, игры и грамматика не считаются — они без лимита всегда.
          Карта не нужна.
        </p>
      </section>
    </main>
  )
}
