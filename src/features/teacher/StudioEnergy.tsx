// Энергия студии (E3) — одной строкой в карточке «Материалы» во «Заданиях»
// (макет t1-3, PLAN.md Ф2.10): сколько разговоров с AI у учеников осталось на
// сегодня. Без пояснений — правка владельца 05.10.2026 «без лишних слов»;
// остаток генераций материалов показывает сам раздел «Материалы». Раньше
// панель стояла над списком учеников и отодвигала его вниз (архитектура §14).
import { IconBolt } from '../../shared/ui/icons'
import type { MyPlan } from '../../lib/billing'

/** Показывать ли: запас есть только у студии с учениками и не у владельца. */
export function hasStudioEnergy(plan: MyPlan | null): plan is MyPlan {
  return !!plan && typeof plan.energy_max === 'number' && !plan.is_admin && !!plan.in_studio
}

export function StudioEnergy({ plan }: { plan: MyPlan }) {
  const max = plan.energy_max ?? 0
  const left = Math.max(0, max - (plan.energy_spent ?? 0))
  return (
    <div className="flex items-center gap-2 text-sm">
      <IconBolt size={18} className="flex-none text-accent-strong" aria-hidden />
      <span className="flex-none text-fg-secondary">Энергия студии</span>
      <span aria-hidden className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-tint/[0.07]">
        <span
          className="block h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${max ? Math.min(100, (left / max) * 100) : 0}%` }}
        />
      </span>
      <span className="flex-none font-medium tabular-nums">
        {left} из {max}
      </span>
    </div>
  )
}
