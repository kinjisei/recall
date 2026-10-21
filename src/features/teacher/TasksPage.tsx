// ============================================================================
// Адрес /tasks — «Задания» учителя (PLAN.md Ф2.10, макеты t1-3 и d7): хаб,
// разделы студии (?tab=materials|writing|guide) и проверка сданной работы из
// хаба (?work=<id назначения>). Всё в адресе: «назад» возвращает на шаг, F5
// оставляет на месте. Раньше разделы были вкладками студии (/teacher?tab=…);
// старые ссылки ведут сюда (TeacherPage). Кто сюда пускается — таблица
// маршрутов (роль teacher), экран сам роль не проверяет.
// ============================================================================
import { useState } from 'react'
import { HOW_IT_WORKS } from '../../data/howItWorks'
import { getMyStudents } from '../../lib/teacher'
import { writingKind } from '../../lib/writingLabels'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { useUrlState } from '../../shared/lib/useUrlState'
import { BackHeader, ScreenTop } from '../../shared/ui/BackButton'
import { HintButton, HintPanel, useHint } from '../../shared/ui/HowItWorks'
import { LoadError } from '../../shared/ui/LoadError'
import { Loading } from '../../shared/ui/Loading'
import { Pager } from '../../shared/ui/Pager'
import { WritingReviewScreen } from '../writing'
import { GuideSection } from './GuideSection'
import { InnerScreenContext } from './innerScreen'
import { MaterialsSection } from './MaterialsSection'
import { ReviewScreen } from './ReviewScreen'
import { TasksHub, type TaskSection } from './TasksHub'
import { refreshWaitingCount } from './waitingCount'
import { loadWaitingWorks, queuePlace, type WaitingWork } from './waitingWorks'
import { WritingSection } from './writing/WritingSection'

const TITLES: Record<TaskSection, string> = {
  materials: 'Материалы',
  writing: 'Письменные задания',
  guide: 'Методичка',
}
const isSection = (v: string) => v in TITLES

export function TasksPage() {
  const [rawTab, setTab] = useUrlState('tab', isSection)
  const tab = rawTab as TaskSection | null
  const [workId, setWorkId] = useUrlState('work')
  // «Собрать материал» в хабе открывает раздел сразу с формой; «назад» в хаб
  // и следующий заход в «Библиотеку» — уже без неё
  const [startForm, setStartForm] = useState(false)
  // внутренний экран раздела со своей шапкой «назад» — шапку раздела прячем (innerScreen.ts)
  const [inner, setInner] = useState(false)
  const hint = useHint()

  // проверка открыта из раздела («На проверку» в «Материалах») — «назад» туда
  if (workId) return <WaitingReview id={workId} backLabel={tab ? TITLES[tab] : 'Задания'} onClose={() => setWorkId(null)} onOpen={(id) => setWorkId(id, { side: true })} />
  if (tab) {
    return (
      <InnerScreenContext.Provider value={setInner}>
        <div className="flex flex-col gap-4">
          {!inner && <BackHeader onBack={() => setTab(null)} title={TITLES[tab]} label="Задания" />}
          {tab === 'guide' ? <GuideSection onExit={() => setTab(null)} /> : <StudentsSection tab={tab} startForm={startForm} onExit={() => setTab(null)} />}
        </div>
      </InnerScreenContext.Provider>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex min-h-11 items-center gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Задания</h1>
          <HintButton open={hint.open} onToggle={hint.toggle} />
        </div>
        <HintPanel open={hint.open}>{HOW_IT_WORKS.tasks}</HintPanel>
      </div>
      <TasksHub
        onSection={(s, form = false) => {
          setStartForm(form)
          setTab(s)
        }}
        onReview={setWorkId}
      />
    </div>
  )
}

/** Материалы и письма — со списком учеников: «для кого» и назначение. */
function StudentsSection({ tab, startForm, onExit }: { tab: 'materials' | 'writing'; startForm: boolean; onExit: () => void }) {
  const { data: students, error, reload } = useAsyncData(getMyStudents, [], 'Не удалось загрузить учеников')
  if (error) return <LoadError message={error} onRetry={reload} />
  if (!students) return <Loading label="Открываем раздел" />
  return tab === 'writing' ? (
    <WritingSection students={students} onExit={onExit} />
  ) : (
    // проверили или сняли сданную работу — число на вкладке «Задания» сходится
    <MaterialsSection students={students} startForm={startForm} onWorksChanged={refreshWaitingCount} onExit={onExit} />
  )
}

/** «Айгерим Нурланова · IELTS Task 2» — что откроется следующим (d7-2 «Дальше откроется»). */
const workTitle = (w: WaitingWork) => `${w.studentName} · ${w.kind === 'writing' ? writingKind(w.task) : `«${w.material.title ?? w.material.topic}»`}`

/**
 * Разбор сданной работы прямо из «Проверки работ». Работу ищем среди ждущих:
 * уже проверенная (в другой вкладке, по старой ссылке) — возвращаемся в хаб,
 * а не показываем пустой экран. Листалка «Работа 2 из 2 ‹ ›» — по той же
 * очереди, что в хабе (новые сверху), по кругу; «Завершить» открывает
 * следующую, последняя — возвращает в хаб.
 */
function WaitingReview({ id, backLabel, onClose, onOpen }: { id: string; backLabel: string; onClose: () => void; onOpen: (id: string) => void }) {
  const { data, error, reload } = useAsyncData(loadWaitingWorks, [id], 'Не удалось открыть работу')
  if (error) return <LoadError message={error} onRetry={reload} />
  if (!data) return <Loading label="Открываем работу" />
  const w = data.find((x) => x.assignment.id === id)
  if (!w) return <Gone label={backLabel} onClose={onClose} />
  const { index, prev, next } = queuePlace(data, id)
  const pager = data.length > 1 && (
    <Pager
      label={`Работа ${index + 1} из ${data.length}`}
      onPrev={prev && (() => onOpen(prev.assignment.id))}
      onNext={next && (() => onOpen(next.assignment.id))}
      prevLabel="Предыдущая работа"
      nextLabel="Следующая работа"
    />
  )
  const done = () => (next ? onOpen(next.assignment.id) : onClose())
  return w.kind === 'writing' ? (
    <WritingReviewScreen key={id} task={w.task} assignment={w.assignment} studentName={w.studentName} backLabel={backLabel} pager={pager} onBack={onClose} onDone={done} />
  ) : (
    <ReviewScreen
      key={id}
      material={w.material}
      assignment={w.assignment}
      studentName={w.studentName}
      backLabel={backLabel}
      pager={pager}
      next={next && workTitle(next)}
      onBack={onClose}
      onDone={done}
    />
  )
}

function Gone({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <ScreenTop back={{ label, onClick: onClose }} title="Проверка работ" />
      <p className="text-sm text-fg-muted">Эту работу уже проверили — она больше не ждёт.</p>
    </div>
  )
}
