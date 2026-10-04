// ============================================================================
// Без тарифа после пробного расписание — только для просмотра (журнал п.41;
// макет t9-3). Плашку «Тариф закончился» над экраном ставит каркас
// (features/billing, app/navigation `showsAccessBanner`), здесь — строка под
// ней и объяснение у выключенных действий. Тариф или пробный — то же правило
// `accessEndedNotice`, что у плашки: слова не разойдутся.
// Это подсказка, а не защита: запись отклоняет база (RECALL_PLAN_REQUIRED).
// ============================================================================
import { accessEndedNotice } from '../../domains/billing'
import type { MyPlan } from '../../lib/billing'
import { AppLink } from '../../shared/ui/AppLink'

/** Почему действие выключено — одна фраза везде (шторки, тост «Новый урок»). */
export const PLAN_REQUIRED_TEXT = 'Чтобы менять расписание и отмечать оплату, продли тариф'

export function ReadOnlyLine({ plan }: { plan: MyPlan | null }) {
  const trial = plan ? accessEndedNotice('teacher', plan)?.source === 'trial' : false
  return (
    <p className="text-note text-fg-secondary">
      Пока тариф не {trial ? 'выбран' : 'продлён'}, расписание только для просмотра; автосписание и «остался 1» на паузе.
    </p>
  )
}

/** Строка в шторке вместо действий (t9-3 «нажатие на выключенное»). */
export function PlanRequired() {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-accent-soft px-3 py-2.5 text-sm text-accent-soft-fg">
      <span className="min-w-0 flex-1">{PLAN_REQUIRED_TEXT}</span>
      <AppLink to="/pay" className="flex min-h-11 items-center font-semibold underline underline-offset-2">
        Продлить
      </AppLink>
    </p>
  )
}
