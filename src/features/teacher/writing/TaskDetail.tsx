// ============================================================================
// Письменное задание в подробностях (макет d9-1 `.d9`, PLAN.md Ф2.17-4в-3):
// ярлык «IELTS · Task 2 · эссе», вопрос, плитки «Целевой балл · Объём ·
// Время», «Назначить ученикам» со сводкой и строкой на ученика — кто сдал,
// кто проверен, кому назначено; внизу — удаление. На телефоне — экраном со
// своим «‹ Письменные задания», на компьютере — рядом со списком.
// ============================================================================
import { useState } from 'react'
import { whenDone } from '../../../domains/schedule'
import { assignWritingTask, listWritingAssignments, unassignWritingTask } from '../../../lib/writing'
import type { StudentInfo } from '../../../lib/teacher'
import type { WritingTask, WritingTaskAssignment } from '../../../types'
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import { AppLink } from '../../../shared/ui/AppLink'
import { Avatar } from '../../../shared/ui/Avatar'
import { BackLink } from '../../../shared/ui/BackButton'
import { Badge } from '../../../shared/ui/Badge'
import { Button } from '../../../shared/ui/Button'
import { LoadError } from '../../../shared/ui/LoadError'
import { RowsSkeleton } from '../../../shared/ui/Loading'
import { ChartView } from '../../../components/ChartView'
import { WritingDeleteButton } from '../WritingDeleteButton'
import { bandText, kindChip, tally, tallyLine, taskFacts } from './writingFacts'
import { ErrorText } from '../../../shared/ui/ErrorText'

/** «сдано сегодня, 15:40» — без рода: «сдала» говорит о человеке то, чего мы не знаем. */
function sinceLine(a: WritingTaskAssignment): string {
  if (a.status === 'submitted') return `сдано ${whenDone(a.submitted_at)}`
  if (a.status === 'reviewed') return `проверено ${whenDone(a.reviewed_at)}`
  return `назначено ${whenDone(a.created_at)}`
}

export function TaskDetail({
  task,
  students,
  onBack,
  onCheck,
  onReview,
  onChanged,
  onDeleted,
}: {
  task: WritingTask
  students: StudentInfo[]
  /** Телефон: экраном, «‹ Письменные задания»; на компьютере список рядом. */
  onBack?: () => void
  /** Сданная работа — та же проверка, что из хаба (листалка по очереди). */
  onCheck: (a: WritingTaskAssignment) => void
  /** Разбор уже проверенной работы. */
  onReview: (a: WritingTaskAssignment, name: string) => void
  /** Назначили или сняли — сводка в списке устарела. */
  onChanged: () => void
  onDeleted: () => void
}) {
  const { data: assignments, error, reload } = useAsyncData<WritingTaskAssignment[]>(() => listWritingAssignments(task.id), [task.id], 'Не удалось загрузить назначения')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const toggle = async (studentId: string, assigned: boolean) => {
    if (busy) return
    setBusy(studentId)
    setErr(null)
    try {
      if (assigned) await unassignWritingTask(task.id, studentId)
      else await assignWritingTask(task.id, studentId)
      reload()
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  const s = task.settings
  const words = [s?.targetWords?.length && `Слова: ${s.targetWords.join(', ')}`, s?.targetGrammar?.length && `Грамматика: ${s.targetGrammar.join(', ')}`].filter(Boolean)
  return (
    // рядом со списком карточка тянется до низа, как список (d9-1)
    <div className="flex min-h-full flex-col gap-3.5">
      {onBack && (
        <div className="self-start">
          <BackLink onClick={onBack} label="Письменные задания" />
        </div>
      )}
      <article className="flex flex-1 flex-col gap-4 rounded-card bg-surface px-6.5 py-5.5 shadow-card">
        <span className="self-start rounded-full bg-accent-soft px-2.5 py-0.5 text-note font-semibold text-accent-soft-fg">{kindChip(task)}</span>
        <p lang={task.lang} className="whitespace-pre-wrap text-xl font-medium leading-normal text-fg">
          {task.prompt}
        </p>
        {s?.chart && (
          <div className="rounded-control border border-line p-3">
            <ChartView chart={s.chart} />
          </div>
        )}
        <dl className="grid grid-cols-3 gap-2">
          {taskFacts(task).map((f) => (
            <div key={f.label} className="flex flex-col gap-0.5 rounded-control-sm bg-input px-3 py-2.5">
              <dt className="text-xs text-fg-muted">{f.label}</dt>
              <dd className="text-body font-semibold text-fg">{f.value}</dd>
            </div>
          ))}
        </dl>
        {words.length > 0 && <p className="-mt-1.5 text-sm text-fg-secondary">{words.join(' · ')}</p>}

        <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5">
          <h3 className="text-lg font-semibold">Назначить ученикам</h3>
          {assignments && <span className="text-sm text-fg-muted">{tallyLine(tally(assignments))}</span>}
        </div>
        {error ? (
          <LoadError message={error} onRetry={reload} />
        ) : students.length === 0 ? (
          <p className="text-sm text-fg-muted">
            Учеников пока нет. Отправь код-приглашение — он на вкладке{' '}
            <AppLink to="/teacher" className="text-accent-strong underline underline-offset-2">
              «Ученики»
            </AppLink>
            . Как только кто-то привяжется, задание назначается в один тап.
          </p>
        ) : !assignments ? (
          <RowsSkeleton count={2} height={60} />
        ) : (
          <div className="flex flex-col rounded-control inset-ring inset-ring-line">
            {students.map((st) => {
              const a = assignments.find((x) => x.student_id === st.profile.id)
              const name = st.profile.display_name || 'без имени'
              return (
                <div key={st.profile.id} className="flex min-h-15 flex-wrap items-center gap-x-3 gap-y-2 border-t border-line py-2 pl-3.5 pr-2.5 first:border-t-0">
                  <Avatar name={name} size={36} />
                  <span className="flex min-w-0 flex-1 basis-36 flex-col leading-snug">
                    <b className="truncate text-body font-semibold">{name}</b>
                    {a && <span className="text-sm text-fg-secondary">{sinceLine(a)}</span>}
                  </span>
                  {/* статус и действие — одной парой: узко — вместе строкой ниже, справа */}
                  <span className="ml-auto flex items-center gap-3">
                    {!a ? (
                      <span className="text-note text-fg-muted">не назначено</span>
                    ) : a.status === 'submitted' ? (
                      <Badge tone="warning">Сдано</Badge>
                    ) : a.status === 'reviewed' ? (
                      <Badge tone="success">{task.mode === 'ielts' ? `Band ${bandText(a.band) || '—'}` : (a.band ?? 'Проверено')}</Badge>
                    ) : (
                      <Badge>Назначено</Badge>
                    )}
                    {a?.status === 'submitted' ? (
                      <Button size="sm" variant="secondary" className="min-w-28" onClick={() => onCheck(a)}>
                        Проверить
                      </Button>
                    ) : a?.status === 'reviewed' ? (
                      <Button size="sm" variant="outline" className="min-w-28" onClick={() => onReview(a, name)}>
                        Разбор
                      </Button>
                    ) : (
                      <Button size="sm" variant={a ? 'ghost' : 'outline'} className="min-w-28" loading={busy === st.profile.id} disabled={busy !== null} onClick={() => void toggle(st.profile.id, !!a)}>
                        {a ? 'Убрать' : 'Назначить'}
                      </Button>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        {err && <ErrorText>{err}</ErrorText>}
        <WritingDeleteButton taskId={task.id} onDeleted={onDeleted} onError={setErr} />
      </article>
    </div>
  )
}
