// Энергия студии (E3) — во «Заданиях», в карточке «Материалы» (макет t1-3,
// PLAN.md Ф2.10): общий дневной запас на разговоры учеников с AI и генерации
// за месяц — их тратят материалы, программы и письма. Раньше стояла над
// списком учеников и отодвигала его вниз (находка ревью, архитектура §14).
import { IconSparkle } from '../../shared/ui/icons'
import type { MyPlan } from '../../lib/billing'

function Meter({ label, value, share }: { label: string; value: string; share: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex-none text-fg-secondary">{label}</span>
      <span className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-tint/[0.07]">
        <span
          className="block h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${Math.min(100, Math.max(0, share * 100))}%` }}
        />
      </span>
      <span className="flex-none font-medium">{value}</span>
    </div>
  )
}

/** Показывать ли: запас есть только у студии с учениками и не у владельца. */
export function hasStudioEnergy(plan: MyPlan | null): plan is MyPlan {
  return !!plan && typeof plan.energy_max === 'number' && !plan.is_admin && !!plan.in_studio
}

export function StudioEnergy({ plan }: { plan: MyPlan }) {
  const max = plan.energy_max ?? 0
  const left = Math.max(0, max - (plan.energy_spent ?? 0))
  const genLim = plan.gen_limit ?? 0
  const genUsed = plan.gen_used ?? 0
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-note font-semibold text-fg-secondary">
        <IconSparkle size={15} className="text-accent-strong" /> Энергия студии
      </p>
      <Meter label="Разговоры с AI сегодня" value={`${left} из ${max}`} share={max ? left / max : 0} />
      {genLim > 0 && <Meter label="Генерации за месяц" value={`${genUsed} из ${genLim}`} share={genUsed / genLim} />}
      <p className="text-xs text-fg-muted">
        {/* Генерации тратят ещё вопрос и график «Письма» — раньше подпись
            называла только материалы, и лимит таял «непонятно от чего». */}
        Разговоры — общий запас на всех учеников, пополняется утром. Генерации тратят
        материалы, программы и задания «Письма»: материал — две (план и текст),
        переделка — ещё одну.
      </p>
    </div>
  )
}
