// ============================================================================
// «Пригласи коллегу» (роут /invite; PLAN.md Ф2.3; журнал п.16; макеты t8-2,
// t8-3). Что получат оба, своя ссылка, «поделиться» в WhatsApp / Telegram /
// системное «Ещё…», как увидит коллега, честный счётчик и три шага.
//
// Начисляет база (миграция 0006) — экран только показывает. Раскладка одна
// на все ширины — колонка, как у «Как оплатить»: на компьютере ей ширина
// колонки впору.
// ============================================================================
import { BackButton } from '../../shared/ui/BackButton'
import { Card } from '../../shared/ui/Card'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { AppLink } from '../../shared/ui/AppLink'
import { IconHeart, IconSparkle, IconTeacher } from '../../shared/ui/icons'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { plural } from '../../shared/lib/plural'
import { AppError } from '../../shared/api/errors'
import { getMyPlan } from '../../lib/billing'
import {
  loadMyReferral,
  REFERRAL_BONUS_DAYS,
  TEACHER_PLANS,
  rewardShort,
  type ReferralStats,
  type TeacherPlanId,
} from '../../domains/billing'
import { InviteShare } from './InviteShare'
import { Ticket } from './Ticket'

type InviteData = { kind: 'ready'; stats: ReferralStats; mine: TeacherPlanId | null } | { kind: 'not_teacher' }

async function loadInvite(): Promise<InviteData> {
  try {
    const [stats, plan] = await Promise.all([loadMyReferral(), getMyPlan()])
    // тариф репетитора — и истёкший: подарок продлит именно его (0006)
    const mine = (TEACHER_PLANS.find((p) => p === plan?.plan) as TeacherPlanId | undefined) ?? null
    return { kind: 'ready', stats, mine }
  } catch (e) {
    // не репетитор — не сбой, а другой экран
    if (e instanceof AppError && e.code === 'RECALL_NOT_TEACHER') return { kind: 'not_teacher' }
    throw e
  }
}

export function InvitePage() {
  const data = useAsyncData(loadInvite, [], 'Не удалось загрузить приглашения')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <BackButton fallback="/teacher" />
      </div>
      <header className="flex items-start">
        <h1 className="text-2xl font-medium tracking-tight">Пригласи коллегу</h1>
        {/* немного игры — единственный экран, где она уместна (промпт t8) */}
        <span aria-hidden className="relative ml-1 h-8 w-12 flex-none text-accent">
          <IconSparkle size={15} className="absolute left-0 top-0" />
          <IconSparkle size={9} className="absolute left-4 top-5 opacity-60" />
          <IconSparkle size={12} className="absolute left-9 top-1 opacity-80" />
        </span>
      </header>
      {data.error ? (
        <LoadError message={data.error} onRetry={data.reload} />
      ) : !data.data ? (
        <RowsSkeleton count={4} />
      ) : data.data.kind === 'not_teacher' ? (
        <NotTeacher />
      ) : (
        <Invite stats={data.data.stats} mine={data.data.mine} />
      )}
    </div>
  )
}

function NotTeacher() {
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-fg-secondary">
        Приглашают коллег репетиторы: за каждого, кто оплатит первый месяц, к своему тарифу добавляется месяц.
      </p>
      <AppLink to="/teacher" className="flex items-center gap-2 text-sm font-medium text-accent-strong">
        <IconTeacher size={17} /> Я веду учеников
      </AppLink>
    </Card>
  )
}

function Invite({ stats, mine }: { stats: ReferralStats; mine: TeacherPlanId | null }) {
  const empty = stats.invited === 0
  const counter = <Counter stats={stats} />
  return (
    <>
      <Ticket mine={mine} />
      {empty ? (
        <Card className="flex items-start gap-3 py-4">
          <IconHeart size={20} className="mt-0.5 flex-none text-accent" />
          <p className="text-sm text-fg-secondary">Пока никого. Начни с одного коллеги — того, кому это пригодится.</p>
        </Card>
      ) : (
        counter
      )}
      <InviteShare code={stats.code} />
      {empty && counter}
      <HowItWorks />
    </>
  )
}

function Tile({ label, value, good = false }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex min-h-24 flex-col justify-between rounded-2xl border border-tint/[0.08] bg-surface p-3 shadow-card">
      <span className="text-caption leading-tight text-fg-muted">{label}</span>
      <span className={`text-2xl font-semibold tracking-tight ${good ? 'text-success-strong' : 'text-fg'}`}>{value}</span>
    </div>
  )
}

function Counter({ stats }: { stats: ReferralStats }) {
  const got = rewardShort(stats.reward)
  return (
    <section aria-label="Счётчик приглашений" data-referral-counter>
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Приглашено" value={String(stats.invited)} />
        <Tile label="Оплатили" value={String(stats.paid)} />
        <Tile label="Получено" value={got} good={got !== '0'} />
      </div>
      {stats.pending > 0 && <Pending count={stats.pending} />}
    </section>
  )
}

/**
 * Коллеги оплатили, а тарифа репетитора у тебя ещё не было — подарки ждут и
 * добавятся к первой оплате (0006). Истёкший тариф база продлевает сразу,
 * поэтому здесь всегда «первой».
 */
function Pending({ count }: { count: number }) {
  return (
    <p className="mt-2 text-note text-fg-muted" data-referral-pending>
      {count === 1
        ? 'Подарок за одного коллегу ждёт твоей первой оплаты тарифа — добавим его сами. '
        : `Подарки за ${count} ${plural(count, 'коллегу', 'коллег', 'коллег')} ждут твоей первой оплаты тарифа — добавим их сами. `}
      <AppLink to="/pay" className="font-medium text-accent-strong">
        Как оплатить
      </AppLink>
    </p>
  )
}

function HowItWorks() {
  const steps = [
    { title: 'Отправь ссылку коллеге' },
    { title: 'Коллега регистрируется по ней', note: `и получает +${REFERRAL_BONUS_DAYS} дней пробного периода` },
    { title: 'Коллега оплачивает первый месяц', note: 'а тебе — месяц к тарифу' },
  ]
  return (
    <section>
      <h2 className="mb-2 text-sm text-fg-muted">Как это работает</h2>
      <Card className="flex flex-col gap-3 py-4">
        {steps.map((s, i) => (
          <div key={s.title} className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent-soft text-caption font-semibold text-accent-soft-fg">
              {i + 1}
            </span>
            <div>
              <p className="text-sm text-fg">{s.title}</p>
              {s.note && <p className="text-note text-fg-muted">{s.note}</p>}
            </div>
          </div>
        ))}
      </Card>
    </section>
  )
}
