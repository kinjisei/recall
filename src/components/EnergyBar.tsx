// ============================================================================
// Полоска «энергия ⚡» (E3) — дневной запас AI-действий, пополняется утром.
// Показывает эффективный остаток: для соло — свой бюджет; для ученика студии —
// её под-кап, но не больше остатка общего пула. У админа и без данных — не рисуем.
// ============================================================================
import { IconSparkle } from './icons'
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

export function EnergyBar({ plan, className = '' }: { plan: MyPlan; className?: string }) {
  const e = energyLeft(plan)
  if (!e || e.cap <= 0) return null
  const pct = Math.round((e.left / e.cap) * 100)
  const low = e.left <= Math.max(1, Math.round(e.cap * 0.2))

  return (
    <div className={`rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] px-4 py-3 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <IconSparkle size={16} className={low ? 'text-amber-400' : 'text-[var(--night-accent-text)]'} />
          Энергия AI
        </span>
        <span className={low ? 'text-amber-400' : 'text-[var(--night-text-70)]'}>
          {e.left} из {e.cap}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${low ? 'bg-amber-400' : 'bg-[var(--night-accent)]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-[var(--night-text-40)]">
        {e.left === 0
          ? 'На сегодня всё — вернётся утром. Слова, тексты и игры работают без энергии.'
          : e.studio
            ? 'Общая энергия студии на разговоры с AI. Пополняется утром.'
            : 'Тратится на Диалог, письмо и квесты. Переводы и произношение — бесплатно.'}
      </p>
    </div>
  )
}
