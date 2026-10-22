// ============================================================================
// «Пригласи коллегу» (роут /invite; PLAN.md Ф2.3; журнал п.16; макеты t8-2,
// t8-3; компьютер — d13-1, d13-2). Что получат оба, своя ссылка,
// «поделиться» в WhatsApp / Telegram / системное «Ещё…», как увидит коллега,
// честный счётчик и три шага.
//
// Начисляет база (миграция 0006) — экран только показывает. Телефон и
// содержимое уже 936 — колонка по t8; шире — InviteDesk: «1 Твоя ссылка» и
// «2 Отправь коллеге» слева, «3 Что получите оба» со счётчиком и «Как это
// работает» справа.
// ============================================================================
import { BackButton } from '../../shared/ui/BackButton'
import { Card } from '../../shared/ui/Card'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import { AppLink } from '../../shared/ui/AppLink'
import { IconHeart, IconSparkle, IconTeacher } from '../../shared/ui/icons'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { AppError } from '../../shared/api/errors'
import { getMyPlan } from '../../lib/billing'
import {
  loadMyReferral,
  TEACHER_PLANS,
  rewardShort,
  type ReferralStats,
  type TeacherPlanId,
} from '../../domains/billing'
import { useAsideSplit } from '../../shared/ui/layouts'
import { InviteDesk } from './InviteDesk'
import { InviteShare } from './InviteShare'
import { HOW_STEPS, Pending } from './inviteBits'
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
  // компьютер (содержимое от 936) — d13-1, d13-2: шаги карточками в две колонки
  const desk = useAsideSplit()

  return (
    <div className="flex flex-col gap-5">
      {desk ? (
        <h1 className="min-h-10 text-2xl font-semibold tracking-tight">Пригласи коллегу</h1>
      ) : (
        <>
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
        </>
      )}
      {data.error ? (
        <LoadError message={data.error} onRetry={data.reload} />
      ) : !data.data ? (
        <RowsSkeleton count={4} />
      ) : data.data.kind === 'not_teacher' ? (
        <NotTeacher />
      ) : desk ? (
        <InviteDesk stats={data.data.stats} mine={data.data.mine} />
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
      {stats.pending > 0 && (
        <div className="mt-2">
          <Pending count={stats.pending} />
        </div>
      )}
    </section>
  )
}

function HowItWorks() {
  const steps = HOW_STEPS
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
