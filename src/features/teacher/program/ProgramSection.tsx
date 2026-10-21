// ============================================================================
// «Программа» — раздел карточки ученика (макеты d11-2, d11-3; PLAN.md
// Ф2.17-4г-1): AI (tier max) составляет недельный план по уровню, цели и
// диагностике, учитель смотрит черновик, составляет заново или сохраняет и
// назначает. Данные — lib/studyPlan.
//
// Сохранённая программа (легенда d11-3): зелёная плашка «Назначена 15 окт ·
// неделя 1 из 4», недели без рамки, пункты, которые ученик отметил «сделал»
// (миграция 0015), — с галочкой; внизу — «Изменить». «Изменить» открывает
// форму с языком, уровнем, неделями и целью этой программы; там же — «Снять
// программу» (в кадре её нет, а снять иначе негде). Программ две (EN и ES) —
// над плашкой выбор языка. Незаконченная программа (черновик) — раздел
// открывается ею.
// ============================================================================
import { useState, type ReactNode } from 'react'
import { useLanguage } from '../../../context/LanguageContext'
import { dateAt } from '../../../domains/schedule'
import { archivePlan, currentWeekIndex, getActivePlans, loadPlanMarks } from '../../../lib/studyPlan'
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import { Button } from '../../../shared/ui/Button'
import { ChoiceGroup } from '../../../shared/ui/ChoiceGroup'
import { useConfirm } from '../../../shared/ui/ConfirmDialog'
import { IconCheck } from '../../../shared/ui/icons'
import { LoadError } from '../../../shared/ui/LoadError'
import { RowsSkeleton } from '../../../shared/ui/Loading'
import type { AppLang, StudyPlan } from '../../../types'
import { PlanView } from '../../program'
import { SectionFooter } from '../sectionBits'
import { ProgramForm } from './ProgramForm'
import { hasProgramDraft } from './programDraft'

const LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1'])

export function ProgramSection({
  studentId,
  name,
  studentLevel,
  daily,
}: {
  studentId: string
  /** Имя ученика — «Айгерим его не видит». */
  name: string
  /** Уровень из профиля — умолчание формы. */
  studentLevel: string | null
  /** «План дня» — под программой, над подвалом раздела. */
  daily: ReactNode
}) {
  const { lang: studio } = useLanguage()
  const plans = useAsyncData(() => getActivePlans(studentId), [studentId], 'Не удалось загрузить программу')
  const [shown, setShown] = useState<AppLang | null>(null)
  const [mode, setMode] = useState<'view' | 'form'>(() => (hasProgramDraft(studentId) ? 'form' : 'view'))
  const { confirm, dialog } = useConfirm()

  const list = plans.data ?? []
  // язык студии, если по нему программа есть; иначе — та, что есть
  const lang: AppLang = shown ?? (list.some((p) => p.lang === studio) ? studio : (list[0]?.lang ?? studio))
  const plan = list.find((p) => p.lang === lang) ?? null

  if (plans.error) return <LoadError message={plans.error} onRetry={plans.reload} />
  // после «Сохранить и назначить» список перечитывается — ждём его, а не мигаем пустой формой
  if (!plans.data || (plans.loading && shown && !plan)) return <RowsSkeleton count={3} height={72} />

  const remove = async (p: StudyPlan) => {
    if (!(await confirm({ title: 'Снять программу?', body: `${name} перестанет её видеть, программа уйдёт в архив.`, action: 'Снять' }))) return
    try {
      await archivePlan(p.id)
      setMode('view')
      plans.reload()
    } catch {
      // сбой — программа на месте, повтор той же кнопкой
    }
  }

  if (mode === 'form' || !plan) {
    const base = plan
      ? { lang: plan.lang, level: plan.level, weeks: plan.weeks.length, goal: plan.goal }
      : { lang, level: studentLevel && LEVELS.has(studentLevel) ? studentLevel : 'B1', weeks: 4, goal: '' }
    return (
      <>
        <ProgramForm
          key={`${plan?.id ?? 'new'}`}
          studentId={studentId}
          name={name}
          base={base}
          activeLangs={list.map((p) => p.lang)}
          onCancel={plan ? () => setMode('view') : undefined}
          onRemove={plan ? () => void remove(plan) : undefined}
          onSaved={(saved) => {
            setShown(saved)
            setMode('view')
            plans.reload()
          }}
          daily={daily}
        />
        {dialog}
      </>
    )
  }

  return (
    <>
      {list.length > 1 && (
        <ChoiceGroup
          variant="segment"
          label="Программа на языке"
          options={list.map((p) => ({ id: p.lang, label: p.lang.toUpperCase() }))}
          value={lang}
          onChange={setShown}
        />
      )}
      <SavedPlan plan={plan} />
      {daily}
      <SectionFooter text={hasProgramDraft(studentId) ? 'Есть черновик новой программы' : `${name} видит её в «Учёбе»`}>
        <Button variant="outline" size="md" onClick={() => setMode('form')}>
          Изменить
        </Button>
      </SectionFooter>
      {dialog}
    </>
  )
}

/** Сохранённая программа: плашка, логика AI, недели с отметками ученика. */
function SavedPlan({ plan }: { plan: StudyPlan }) {
  const marks = useAsyncData(() => loadPlanMarks([plan.id]), [plan.id], 'Не удалось загрузить отметки')
  const week = currentWeekIndex(plan)
  return (
    <>
      <p className="flex items-center gap-2.5 rounded-control-sm bg-success-soft px-3.5 py-2.5 text-sm font-medium text-success-soft-fg" data-program-saved>
        <IconCheck size={18} aria-hidden className="flex-none" />
        <span>
          <b className="font-bold">Назначена {dateAt(plan.created_at)}</b> · неделя {week} из {plan.weeks.length}
        </span>
      </p>
      {plan.summary && <p className="px-1 text-body text-fg">{plan.summary}</p>}
      {/* отметки не пришли — недели без галочек и строка о сбое, а не «ничего не сделано» */}
      {marks.error && <LoadError message={marks.error} onRetry={marks.reload} />}
      <PlanView weeks={plan.weeks} currentWeek={week} marks={marks.data?.get(plan.id)} />
    </>
  )
}
