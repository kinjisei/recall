// ============================================================================
// Адрес /tasks — «Задания» учителя (PLAN.md Ф2.10, макет t1-3): хаб, разделы
// студии (?tab=materials|writing|guide) и проверка сданной работы из хаба
// (?work=<id назначения>). Всё в адресе: «назад» возвращает на шаг, F5
// оставляет на месте. Раньше разделы были вкладками студии (/teacher?tab=…);
// старые ссылки ведут сюда (TeacherPage). Кто сюда пускается — таблица
// маршрутов (роль teacher), экран сам роль не проверяет.
// ============================================================================
import { useState } from 'react'
import { HOW_IT_WORKS } from '../../data/howItWorks'
import { getMyStudents } from '../../lib/teacher'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { useUrlState } from '../../shared/lib/useUrlState'
import { BackHeader } from '../../shared/ui/BackButton'
import { HowItWorks } from '../../shared/ui/HowItWorks'
import { LoadError } from '../../shared/ui/LoadError'
import { Loading } from '../../shared/ui/Loading'
import { WritingReviewScreen } from '../writing'
import { GuideSection } from './GuideSection'
import { InnerScreenContext } from './innerScreen'
import { MaterialsSection } from './MaterialsSection'
import { ReviewScreen } from './ReviewScreen'
import { TasksHub, type TaskSection } from './TasksHub'
import { refreshWaitingCount } from './waitingCount'
import { loadWaitingWorks } from './waitingWorks'
import { WritingSection } from './WritingSection'

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

  if (workId) return <WaitingReview id={workId} onClose={() => setWorkId(null)} />
  if (tab) {
    return (
      <InnerScreenContext.Provider value={setInner}>
        <div className="flex flex-col gap-4">
          {!inner && <BackHeader onBack={() => setTab(null)} title={TITLES[tab]} label="Задания" />}
          {tab === 'guide' ? <GuideSection /> : <StudentsSection tab={tab} startForm={startForm} />}
        </div>
      </InnerScreenContext.Provider>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Задания</h1>
      <HowItWorks>{HOW_IT_WORKS.tasks}</HowItWorks>
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
function StudentsSection({ tab, startForm }: { tab: 'materials' | 'writing'; startForm: boolean }) {
  const { data: students, error, reload } = useAsyncData(getMyStudents, [], 'Не удалось загрузить учеников')
  if (error) return <LoadError message={error} onRetry={reload} />
  if (!students) return <Loading label="Открываем раздел" />
  return tab === 'writing' ? (
    <WritingSection students={students} />
  ) : (
    // проверили или сняли сданную работу — число на вкладке «Задания» сходится
    <MaterialsSection students={students} startForm={startForm} onWorksChanged={refreshWaitingCount} />
  )
}

/**
 * Разбор сданной работы прямо из «Проверки работ». Работу ищем среди ждущих:
 * уже проверенная (в другой вкладке, по старой ссылке) — возвращаемся в хаб,
 * а не показываем пустой экран.
 */
function WaitingReview({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error, reload } = useAsyncData(loadWaitingWorks, [id], 'Не удалось открыть работу')
  if (error) return <LoadError message={error} onRetry={reload} />
  if (!data) return <Loading label="Открываем работу" />
  const w = data.find((x) => x.assignment.id === id)
  if (!w) return <Gone onClose={onClose} />
  return w.kind === 'writing' ? (
    <WritingReviewScreen task={w.task} assignment={w.assignment} studentName={w.studentName} onBack={onClose} onDone={onClose} />
  ) : (
    <ReviewScreen material={w.material} assignment={w.assignment} studentName={w.studentName} onBack={onClose} onDone={onClose} />
  )
}

function Gone({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <BackHeader onBack={onClose} title="Проверка работ" label="Задания" />
      <p className="text-sm text-fg-muted">Эту работу уже проверили — она больше не ждёт.</p>
    </div>
  )
}
