// ============================================================================
// «Билет» на экране «Пригласи коллегу» (макет t8-2): что получат оба. Две
// половины с перфорацией — единственное место приложения, где уместно немного
// игры (промпт t8). Цифры и сноски — из правил базы (миграция 0006): коллеге
// +7 дней пробного, тебе — месяц к тарифу, если коллега оплатил тариф не
// дешевле твоего, иначе дни на ту же сумму.
// ============================================================================
import type { ReactNode } from 'react'
import { IconInfinity } from '../../shared/ui/icons'
import {
  cheaperNote,
  planCard,
  planShortTitle,
  REFERRAL_BONUS_DAYS,
  TEACHER_PLANS,
  type TeacherPlanId,
} from '../../domains/billing'
import { plural } from '../../shared/lib/plural'

const teacherPlans = TEACHER_PLANS as TeacherPlanId[]
const PRICES = Object.fromEntries(teacherPlans.map((p) => [p, planCard(p).price])) as Record<TeacherPlanId, number>
const TITLES = Object.fromEntries(teacherPlans.map((p) => [p, planShortTitle(p)])) as Record<TeacherPlanId, string>

function Half({ label, big, text, children }: { label: string; big: string; text: string; children?: ReactNode }) {
  return (
    <div className="px-5 py-4">
      <p className="text-caption font-semibold uppercase tracking-wide text-fg-secondary">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-accent-strong">{big}</p>
      <p className="mt-0.5 text-sm text-fg-secondary">{text}</p>
      {children}
    </div>
  )
}

export function Ticket({ mine }: { mine: TeacherPlanId | null }) {
  const note = cheaperNote(mine, PRICES, TITLES)
  return (
    <div className="relative overflow-hidden rounded-3xl border border-accent-line-soft bg-surface bg-linear-[160deg] from-cta to-cta-end shadow-card">
      <Half
        label="Коллеге"
        big={`+${REFERRAL_BONUS_DAYS} ${plural(REFERRAL_BONUS_DAYS, 'день', 'дня', 'дней')}`}
        text="пробного периода"
      />
      {/* перфорация: пунктир и два выреза по краям цветом страницы */}
      <div aria-hidden className="relative mx-5 border-t border-dashed border-accent-line-soft">
        <span className="absolute -left-8 -top-3 h-6 w-6 rounded-full border border-accent-line-soft bg-page" />
        <span className="absolute -right-8 -top-3 h-6 w-6 rounded-full border border-accent-line-soft bg-page" />
      </div>
      <Half label="Тебе" big="+1 месяц" text="к тарифу за каждого, кто оплатит первый месяц">
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-tint/[0.10] bg-surface px-2.5 py-1 text-caption font-medium text-fg-secondary">
          <IconInfinity size={16} /> Сколько угодно коллег
        </span>
        {note && <p className="mt-3 text-note text-fg-muted">{note}</p>}
        {!mine && (
          <p className="mt-2 text-note text-fg-muted">
            Своего тарифа пока нет — подарок подождёт и добавится к первой оплате.
          </p>
        )}
      </Half>
    </div>
  )
}
