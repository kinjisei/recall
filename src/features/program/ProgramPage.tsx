// ============================================================================
// «Моя программа» (роут /program) — сторона ученика: активные программы от
// преподавателя с меткой текущей недели. План ведёт преподаватель; ученик
// отмечает пункт «сделал» нажатием (миграция 0015, журнал п.76 (9)) —
// преподаватель видит галочки в карточке. Отметка сразу на экране; не
// записалась — возвращается и говорит, что не вышло.
// ============================================================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { currentWeekIndex, getMyPlans, loadPlanMarks, markKey, markProgramSeen, setPlanItemDone, type PlanMarks } from '../../lib/studyPlan'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { BackHeader } from '../../shared/ui/BackButton'
import { Card } from '../../shared/ui/Card'
import { LoadError } from '../../shared/ui/LoadError'
import { RowsSkeleton } from '../../shared/ui/Loading'
import type { StudyPlan } from '../../types'
import { PlanView } from './PlanView'
import { ErrorText } from '../../shared/ui/ErrorText'

async function loadPlans(): Promise<{ plans: StudyPlan[]; marks: Map<string, PlanMarks> }> {
  const plans = await getMyPlans()
  return { plans, marks: await loadPlanMarks(plans.map((p) => p.id)) }
}

export function ProgramPage() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useAsyncData(loadPlans, [], 'Не удалось загрузить программу')
  // отметки на экране: сразу после нажатия, до ответа базы
  const [local, setLocal] = useState<Map<string, PlanMarks> | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const marks = local ?? data?.marks ?? new Map<string, PlanMarks>()

  // программа открыта — уведомление «тебе назначили программу» на Главной гаснет
  useEffect(() => {
    for (const p of data?.plans ?? []) markProgramSeen(p.id)
  }, [data])

  const toggle = async (plan: StudyPlan, week: number, item: number, done: boolean) => {
    const key = markKey(week, item)
    const before = marks
    const next = new Set(before.get(plan.id))
    if (done) next.add(key)
    else next.delete(key)
    setLocal(new Map(before).set(plan.id, next))
    setPending(`${plan.id}/${key}`)
    setFailed(null)
    try {
      await setPlanItemDone(plan.id, week, item, done)
    } catch (e) {
      setLocal(before)
      setFailed(e instanceof Error ? e.message : 'Не удалось отметить — попробуй ещё раз')
    } finally {
      setPending(null)
    }
  }

  const plans = data?.plans ?? []
  return (
    <div className="flex flex-col gap-4">
      <BackHeader onBack={() => navigate('/study')} title="Моя программа" />

      {loading ? (
        <RowsSkeleton count={3} />
      ) : error ? (
        <LoadError message={error} onRetry={reload} />
      ) : plans.length === 0 ? (
        <Card className="text-center">
          <p className="font-semibold">Программы пока нет</p>
          <p className="mt-1 text-sm text-fg-muted">Программу обучения составляет преподаватель — попроси её назначить.</p>
        </Card>
      ) : (
        <>
          <p className="text-body text-fg-secondary">Пункт готов — нажми на него: преподаватель увидит галочку.</p>
          {failed && (
            <ErrorText>
              {failed}
            </ErrorText>
          )}
          {plans.map((plan) => {
            const week = currentWeekIndex(plan)
            const prefix = `${plan.id}/`
            return (
              <section key={plan.id} className="flex flex-col gap-2.5" data-my-program={plan.lang}>
                <div>
                  <h2 className="text-lg font-semibold">
                    {plan.lang === 'es' ? 'Испанский' : 'Английский'} · неделя {week} из {plan.weeks.length}
                  </h2>
                  <p className="text-note text-fg-muted">Уровень {plan.level}</p>
                </div>
                <PlanView
                  weeks={plan.weeks}
                  currentWeek={week}
                  marks={marks.get(plan.id)}
                  pending={pending?.startsWith(prefix) ? pending.slice(prefix.length) : null}
                  onToggle={(w, i, done) => void toggle(plan, w, i, done)}
                />
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}
