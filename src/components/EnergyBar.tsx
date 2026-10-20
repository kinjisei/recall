// ============================================================================
// Описание: src/features/billing/CLAUDE.md
// Полоска «энергия ⚡» (E3) — дневной запас на разговоры с AI, пополняется утром.
// ⚠️ Единица измерения ОДНА на весь продукт: ⚡. Любой текст про лимиты AI
// (цена разбора, отказ сервера, тарифы, оферта) говорит про энергию, а не про
// «AI-действия», «запросы» или «в день» — иначе человек сверяет цену с числом,
// которого на экране нет (находка ревью 2В).
// Показывает эффективный остаток: для соло — свой бюджет; для ученика студии —
// её под-кап, но не больше остатка общего пула. У админа и без данных — не рисуем.
// ============================================================================
import { IconBolt } from '../shared/ui/icons'
import { useCountUp } from '../lib/useCountUp'
import type { MyPlan } from '../lib/billing'

export function energyLeft(plan: MyPlan): { left: number; cap: number; studio: boolean } | null {
  if (plan.is_admin) return null
  if (typeof plan.energy_max !== 'number') return null // миграция не залита
  const studio = !!plan.in_studio && typeof plan.energy_subcap === 'number'
  const cap = studio ? (plan.energy_subcap as number) : plan.energy_max
  const used = studio ? plan.energy_self ?? 0 : plan.energy_spent ?? 0
  const poolLeft = Math.max(0, plan.energy_max - (plan.energy_spent ?? 0))
  const left = Math.max(0, Math.min(cap - used, poolLeft))
  return { left, cap, studio }
}

/**
 * Тихая строка энергии на Главной (макеты u1-1, d4-v2): ⚡, «Энергия на
 * AI-задания», полоса, «9 из 14». Мало осталось — полоса и число цветом
 * предупреждения. Высота 44 на телефоне, 32 на компьютере (`compact`).
 */
export function EnergyBar({ plan, compact = false }: { plan: MyPlan; compact?: boolean }) {
  const e = energyLeft(plan)
  // ⚠️ хук зовём ДО раннего выхода: порядок хуков должен быть одинаковым при
  // каждом рендере, иначе React упадёт, когда полоска то показывается, то нет
  const shownLeft = useCountUp(e?.left ?? 0)
  if (!e || e.cap <= 0) return null
  const pct = Math.round((e.left / e.cap) * 100)
  const low = e.left <= Math.max(1, Math.round(e.cap * 0.2))

  return (
    <section
      aria-label={`Энергия на AI-задания: ${e.left} из ${e.cap}${e.left === 0 ? ', вернётся утром' : ''}`}
      className={`flex items-center gap-2.5 text-note text-fg-muted ${compact ? 'min-h-8 px-1.5' : 'min-h-11 px-1'}`}
    >
      <IconBolt size={16} aria-hidden className={`flex-none ${low ? 'text-warning-strong' : 'text-accent-strong'}`} />
      <span className="whitespace-nowrap">Энергия на AI-задания</span>
      <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-input">
        <span
          className={`block h-full w-full origin-left rounded-full transition-transform duration-500 ease-out ${low ? 'bg-warning' : 'bg-accent'}`}
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </span>
      <span aria-hidden className={`whitespace-nowrap tabular-nums ${low ? 'text-warning-strong' : ''}`}>
        {shownLeft} из {e.cap}
      </span>
    </section>
  )
}
