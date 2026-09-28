// ============================================================================
// «Тарифы» (роут /pricing) — публичная страница, работает и без входа
// (ссылка со страницы входа/настроек). Показывает статичные карточки тарифов
// из lib/billing.ts и, если пользователь вошёл и RPC get_my_plan уже есть в
// БД, плашку с его текущим тарифом.
// ============================================================================
import { useEffect, useState } from 'react'
import { IconCheck, IconTeacher, IconTrophy } from '../../shared/ui/icons'
import { SmartBack } from '../../shared/ui/SmartBack'
import { useAuth } from '../../context/AuthContext'
import { PLANS, KASPI, getMyPlan, type MyPlan, type PlanCard } from '../../lib/billing'
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
    statusLine = `Триал до ${formatDate(plan.trial_until)}${energyBit ? ` · ${energyBit}` : ''}`
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

function PlanCardView({ plan }: { plan: PlanCard }) {
  return (
    <div className="animate-fade-up rounded-2xl border border-white/[0.08] bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{plan.title}</h3>
        {plan.studentLimit && (
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-fg-muted">
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
    </div>
  )
}

/**
 * Реквизиты Kaspi — под кнопкой «Хочу оплатить». Номер не показываем на
 * публичной странице сразу (решение владельца): он раскрывается только тому,
 * кто уже собрался платить.
 */
function PayDetails() {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="lift mt-3 inline-flex min-h-[44px] items-center rounded-xl border border-accent-line bg-accent-soft px-4 text-sm font-medium text-accent-soft-fg"
      >
        Хочу оплатить — показать реквизиты
      </button>
    )
  }
  return (
    <div className="mt-3 rounded-xl border border-accent-line bg-accent-soft/40 p-3 text-sm leading-relaxed text-fg-secondary">
      Kaspi: <span className="font-medium text-fg">{KASPI.phone}</span> ({KASPI.name}).
      <br />В комментарии к переводу укажи email своего аккаунта — так мы поймём, кому включить тариф.
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
    <main className="mx-auto min-h-[100dvh] max-w-screen-sm bg-page px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1.5rem)] text-fg">
      <SmartBack fallback={user ? '/' : '/login'} />

      <h1 className="text-2xl font-medium tracking-tight">Тарифы</h1>
      <p className="mt-1 text-sm text-fg-muted">
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
        <IconTeacher size={18} className="text-fg-muted" />
        <h2 className="font-medium">Для преподавателя</h2>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {teacherPlans.map((p) => (
          <PlanCardView key={p.id} plan={p} />
        ))}
      </div>

      <section className="animate-fade-up mt-8 rounded-2xl border border-white/[0.08] bg-surface p-4">
        <h2 className="font-medium">Как оплатить</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
          Оплата переводом в Kaspi. Реквизиты покажем, когда решишь платить, —
          нажми кнопку ниже. Тариф включаем руками, обычно в тот же день (если
          перевёл ночью — жди утра). Карту не привязываем и сами ничего не
          списываем: чтобы продлить, переведёшь снова.
        </p>
        <PayDetails />
        <p className="mt-3 text-sm leading-relaxed text-fg-secondary">
          Первые 14 дней после регистрации — пробный период: все разделы открыты.
          Энергии первые три дня столько же, сколько на Premium (30 ⚡ в день),
          дальше — 15 ⚡. Энергию тратят разговоры с AI: реплика в «Диалоге», ход
          в квесте и разбор фрагмента текста — 1 ⚡, проверка письма — 2 ⚡
          (у разбора целого текста цена видна до запуска: он режется на куски по
          1 ⚡). Перевод слов по тапу и произношение энергию не тратят, у них свой
          суточный запас, которого хватает с большим запасом (на пробном периоде —
          по 150 в день). Повторение карточек, игры и грамматика не ограничены
          ничем. Карта не нужна. Репетитору на пробном периоде дают 2 генерации —
          ровно один материал целиком, чтобы увидеть качество своими глазами;
          с первым привязанным учеником их становится 3 в месяц.
        </p>
      </section>
    </main>
  )
}
