// Панель энергии студии (E3): общий дневной пул на всех учеников + месячные
// генерации материалов/программ. Показывается на вкладке «Ученики».
import { Card } from '../../shared/ui/Card'
import { IconSparkle } from '../../shared/ui/icons'
import type { MyPlan } from '../../lib/billing'

export function StudioEnergy({ plan }: { plan: MyPlan }) {
  const max = plan.energy_max ?? 0
  const spent = plan.energy_spent ?? 0
  const left = Math.max(0, max - spent)
  const genLim = plan.gen_limit ?? 0
  const genUsed = plan.gen_used ?? 0
  const bar = (used: number, cap: number) => (
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-tint/[0.07]">
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-500"
        style={{ width: `${cap ? Math.min(100, (used / cap) * 100) : 0}%` }}
      />
    </div>
  )
  return (
    <Card className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <IconSparkle size={16} className="text-accent-strong" /> Энергия студии
      </p>
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-fg-secondary">Разговоры с AI сегодня</span>
          <span className="font-medium">{left} из {max} осталось</span>
        </div>
        {bar(spent, max)}
        <p className="mt-1 text-xs text-fg-muted">
          Общий дневной запас на всех учеников. Пополняется утром.
        </p>
      </div>
      {genLim > 0 && (
        <div>
          <div className="flex items-center justify-between text-sm">
            {/* Раньше подпись называла только материалы и программы, а тот же
                счётчик тратят вопрос и график «Письма» — репетитор видел, как
                лимит тает от действий, которые материалами не считал. */}
            <span className="text-fg-secondary">Генерации AI за месяц</span>
            <span className="font-medium">{genUsed} из {genLim}</span>
          </div>
          {bar(genUsed, genLim)}
          <p className="mt-1 text-xs text-fg-muted">
            Материалы, программы и задания «Письма». Материал стоит двух генераций
            (план и текст), каждая переделка — ещё одной.
          </p>
        </div>
      )}
    </Card>
  )
}
