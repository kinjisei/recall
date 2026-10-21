// ============================================================================
// Мастер нового материала (макеты d8-2…d8-5, PLAN.md Ф2.17-4в-2б): заявка →
// план от AI → текст; «Мой текст» — заявка → текст. Здесь только разводка
// шагов; переходы и «назад» без потерь — wizard.ts, черновик шагов —
// MaterialsSection. Ответ AI приходит позже нажатия, поэтому шаги меняются
// через update(f => …) — от того, что сейчас в черновике, а не от снимка
// на момент нажатия.
// ============================================================================
import type { ReactNode } from 'react'
import type { StudentInfo } from '../../../lib/teacher'
import type { Material } from '../../../types'
import { RequestForm } from './RequestForm'
import { PlanScreen } from './PlanScreen'
import { PreviewScreen } from './PreviewScreen'
import { useStudentLevels } from './useStudentLevels'
import { advance, ahead, back, current, forward, replace, type Flow } from './wizard'

export function MaterialWizard({
  flow,
  update,
  students,
  gens,
  restored,
  onSpent,
  onSaved,
  onExit,
}: {
  flow: Flow
  /** Новый шаг от нынешнего черновика; null — мастер закрыт. */
  update: (next: (f: Flow) => Flow | null) => void
  students: StudentInfo[]
  gens: { left: number; limit: number } | null
  /** «Черновик восстановлен» над планом и текстом. */
  restored: ReactNode
  /** Генерация могла списаться — обновить остаток. */
  onSpent: () => void
  onSaved: (material: Material, notice?: string) => void
  /** Выйти из мастера, выбросив его черновики. */
  onExit: () => void
}) {
  // уровни учеников — один запрос на все шаги: заявка, итог плана, «Назначится»
  const levels = useStudentLevels(students)
  const step = current(flow)
  const next = ahead(flow)

  if (step.name === 'form') {
    return (
      <RequestForm
        students={students}
        levels={levels}
        gens={gens}
        resumeLabel={next && (next.name === 'plan' ? 'Вернуться к плану' : 'Вернуться к упражнениям')}
        onResume={() => update(forward)}
        onCancel={onExit}
        onPlanned={(req, plan, replan) => {
          onSpent()
          update((f) => advance(f, { name: 'plan', req, plan, replan }))
        }}
        onOwnGenerated={(req, plan, content) => {
          onSpent()
          update((f) => advance(f, { name: 'preview', req, plan, content, own: true }))
        }}
      />
    )
  }
  if (step.name === 'plan') {
    return (
      <>
        {restored}
        <PlanScreen
          req={step.req}
          plan={step.plan}
          grant={step.replan}
          levels={levels}
          gens={gens}
          onBack={() => update(back)}
          onForward={next ? () => update(forward) : undefined}
          onExit={onExit}
          onEdited={(req, plan) => update((f) => replace(f, { ...step, req, plan }))}
          onReplanned={(plan, replan) => {
            onSpent()
            update((f) => replace(f, { ...step, plan, replan }))
          }}
          onGenerated={(content, stay) => {
            onSpent()
            update((f) => {
              const done = advance(f, { name: 'preview', req: step.req, plan: step.plan, content })
              // учитель вернулся к плану, пока AI писал: текст — готовым шагом впереди
              return stay ? back(done) : done
            })
          }}
        />
      </>
    )
  }
  return (
    <>
      {restored}
      <PreviewScreen
        req={step.req}
        plan={step.plan}
        content={step.content}
        own={step.own}
        levels={levels}
        gens={gens}
        onBack={() => update(back)}
        onToForm={() => update((f) => ({ ...f, at: 0 }))}
        onExit={onExit}
        onRegenerated={(content) => {
          onSpent()
          update((f) => replace(f, { ...step, content }))
        }}
        onSaved={onSaved}
      />
    </>
  )
}
