// ============================================================================
// «Письменные задания» учителя (макеты d9-1, d9-2, PLAN.md Ф2.17-4в-3): шапка
// «‹ Задания · Письменные задания» и «+ Новое письмо»; на компьютере список
// слева и задание рядом (ListDetail fill), на телефоне — по очереди.
// Открытое задание — в адресе (?wt=), как материал (?mat=): «назад» и ссылка
// работают. Сданная работа — та же проверка, что из хаба (?work=, листалка),
// разбор проверенной — здесь же. «Новое письмо» — панелью справа (шторкой на
// телефоне); есть черновик — панель открыта сразу, иначе его не увидеть (Ф1.14).
// ============================================================================
import { useState } from 'react'
import { listMyWritingTasks, listTaskStatuses } from '../../../lib/writing'
import type { StudentInfo } from '../../../lib/teacher'
import type { WritingTask, WritingTaskAssignment } from '../../../types'
import { readDraft } from '../../../shared/lib/drafts'
import { useAsyncData } from '../../../shared/lib/useAsyncData'
import { useUrlState } from '../../../shared/lib/useUrlState'
import { ScreenTop } from '../../../shared/ui/BackButton'
import { Button } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'
import { IconPlus } from '../../../shared/ui/icons'
import { ListDetail, useListDetailSplit } from '../../../shared/ui/layouts'
import { LoadError } from '../../../shared/ui/LoadError'
import { RowsSkeleton } from '../../../shared/ui/Loading'
import { WritingReviewScreen } from '../../writing'
import { useInnerScreen } from '../innerScreen'
import { WRITING_TASK_DRAFT } from '../useWritingTaskDraft'
import { NewWritingPanel } from './NewWritingPanel'
import { TaskDetail } from './TaskDetail'
import { TaskList } from './TaskList'
import { tally, type Tally } from './writingFacts'

export function WritingSection({ students, onExit }: { students: StudentInfo[]; onExit: () => void }) {
  useInnerScreen(true) // шапка своя — «‹ Задания»
  const { data: tasks, error, loading, reload } = useAsyncData<WritingTask[]>(() => listMyWritingTasks(), [], 'Не удалось загрузить задания')
  const ids = (tasks ?? []).map((t) => t.id)
  // сводка выдач — подпись строки; не загрузилась — строки без неё, а не «не назначено»
  const statuses = useAsyncData(() => listTaskStatuses(ids), [ids.join(',')], 'Не удалось загрузить выдачи')
  const [taskId, setTaskId] = useUrlState('wt')
  const [, setWorkId] = useUrlState('work')
  const [creating, setCreating] = useState(() => !!readDraft(WRITING_TASK_DRAFT))
  const [reviewing, setReviewing] = useState<{ a: WritingTaskAssignment; name: string } | null>(null)
  const split = useListDetailSplit()
  // чужое или удалённое задание по ссылке — список, а не пустой экран
  const open = taskId ? (tasks ?? []).find((t) => t.id === taskId) : undefined

  if (reviewing && open) {
    return (
      <WritingReviewScreen
        task={open}
        assignment={reviewing.a}
        studentName={reviewing.name}
        backLabel="Письменные задания"
        onBack={() => setReviewing(null)}
        onDone={() => {
          setReviewing(null)
          statuses.reload()
        }}
      />
    )
  }

  const tallies = statuses.data ? groupTallies(statuses.data) : null
  const panel = creating && (
    <NewWritingPanel
      onClose={() => setCreating(false)}
      onCreated={(t) => {
        setCreating(false)
        reload()
        setTaskId(t.id)
      }}
    />
  )
  const detail = open && (
    <TaskDetail
      key={open.id}
      task={open}
      students={students}
      onBack={split ? undefined : () => setTaskId(null)}
      onCheck={(a) => setWorkId(a.id)}
      onReview={(a, name) => setReviewing({ a, name })}
      onChanged={statuses.reload}
      onDeleted={() => {
        reload()
        setTaskId(null)
      }}
    />
  )
  // телефон: открытое задание — экраном; черновик «Нового письма» и здесь открывает панель
  if (detail && !split) {
    return (
      <>
        {detail}
        {panel}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ScreenTop
        back={{ label: 'Задания', onClick: onExit }}
        title="Письменные задания"
        trailing={
          <Button onClick={() => setCreating(true)}>
            <IconPlus size={18} aria-hidden /> Новое письмо
          </Button>
        }
      />
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : loading && !tasks ? (
        <RowsSkeleton count={3} height={88} />
      ) : (tasks ?? []).length === 0 ? (
        <Card>
          <p className="font-semibold">Пока нет заданий</p>
          <p className="mt-1 text-sm text-fg-muted">Создай письмо в режиме IELTS или обычного эссе и назначь ученикам.</p>
        </Card>
      ) : (
        <ListDetail
          fill
          list={<TaskList tasks={tasks ?? []} tallies={tallies} selectedId={open?.id ?? null} onOpen={(t) => setTaskId(t.id)} />}
          detail={detail || null}
          empty="Выбери задание слева — откроются вопрос и кому оно назначено."
        />
      )}
      {panel}
    </div>
  )
}

function groupTallies(rows: Pick<WritingTaskAssignment, 'task_id' | 'status'>[]): Map<string, Tally> {
  const by = new Map<string, Pick<WritingTaskAssignment, 'status'>[]>()
  for (const r of rows) by.set(r.task_id, [...(by.get(r.task_id) ?? []), r])
  return new Map([...by].map(([id, list]) => [id, tally(list)]))
}
