// ============================================================================
// Полоска «энергия ⚡» (E3) — дневной запас на разговоры с AI, пополняется утром.
// ⚠️ Единица измерения ОДНА на весь продукт: ⚡. Любой текст про лимиты AI
// (цена разбора, отказ сервера, тарифы, оферта) говорит про энергию, а не про
// «AI-действия», «запросы» или «в день» — иначе человек сверяет цену с числом,
// которого на экране нет (находка ревью 2В).
// Показывает эффективный остаток: для соло — свой бюджет; для ученика студии —
// её под-кап, но не больше остатка общего пула. У админа и без данных — не рисуем.
// ============================================================================
import { IconSparkle } from './icons'
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

export function EnergyBar({ plan, className = '' }: { plan: MyPlan; className?: string }) {
  const e = energyLeft(plan)
  // ⚠️ хук зовём ДО раннего выхода: порядок хуков должен быть одинаковым при
  // каждом рендере, иначе React упадёт, когда полоска то показывается, то нет
  const shownLeft = useCountUp(e?.left ?? 0)
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
          {shownLeft} из {e.cap}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={`h-full w-full origin-left rounded-full transition-transform duration-500 [transition-timing-function:cubic-bezier(.22,1,.36,1)] ${low ? 'bg-amber-400' : 'bg-[var(--night-accent)]'}`}
          style={{ transform: `scaleX(${pct / 100})` }}
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
