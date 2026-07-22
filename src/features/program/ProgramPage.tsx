// ============================================================================
// «Моя программа» (роут /program) — сторона ученицы: активные программы от
// преподавателя с подсветкой текущей недели. Только просмотр — план ведёт
// преподаватель. Пункты — ориентиры: чем заниматься на этой неделе в разделах
// «Учёба», «Практика» и «Диалог».
// ============================================================================
import { useNavigate } from 'react-router-dom'
import { BackHeader } from '../../components/BackButton'
import { Card } from '../../components/Card'
import { LoadError } from '../../components/LoadError'
import { useAsyncData } from '../../lib/useAsyncData'
import { currentWeekIndex, getMyPlans } from '../../lib/studyPlan'
import { PlanView } from './PlanView'
import type { StudyPlan } from '../../types'

export function ProgramPage() {
  const navigate = useNavigate()
  const { data: plans, error, loading, reload } = useAsyncData<StudyPlan[]>(
    getMyPlans,
    [],
    'Не удалось загрузить программу',
  )

  return (
    <div className="flex flex-col gap-4">
      <BackHeader onBack={() => navigate('/study')} title="Моя программа" />

      {loading ? (
        <p className="text-[var(--night-text-40)]">Загрузка…</p>
      ) : error ? (
        <LoadError message={error} onRetry={reload} />
      ) : (plans ?? []).length === 0 ? (
        <Card className="text-center">
          <p className="font-semibold">Программы пока нет</p>
          <p className="mt-1 text-sm text-[var(--night-text-40)]">
            Программу обучения составляет преподаватель — попроси её назначить.
          </p>
        </Card>
      ) : (
        (plans ?? []).map((plan) => {
          const week = currentWeekIndex(plan)
          return (
            <section key={plan.id} className="flex flex-col gap-2.5">
              <div>
                <h2 className="text-lg font-semibold">
                  {plan.lang.toUpperCase()} · неделя {week} из {plan.weeks.length}
                </h2>
                <p className="text-xs text-[var(--night-text-40)]">
                  Уровень {plan.level} · старт {plan.start_day}
                </p>
              </div>
              <PlanView weeks={plan.weeks} currentWeek={week} />
            </section>
          )
        })
      )}
    </div>
  )
}
