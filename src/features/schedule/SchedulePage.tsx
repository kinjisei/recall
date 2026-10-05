// ============================================================================
// Адрес /schedule (PLAN.md Ф2.7): расписание репетитора — первая вкладка
// меню учителя и его стартовый экран (Ф2.10). Кто сюда пускается — таблица
// маршрутов (роль teacher): не-репетитору — приглашение «Ведёшь учеников?»,
// экран сам роль не проверяет.
// ============================================================================
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { LoadError } from '../../shared/ui/LoadError'
import { Loading } from '../../shared/ui/Loading'
import { ScheduleScreen } from './ScheduleScreen'
import { useScheduleBase } from './useScheduleData'

export function SchedulePage() {
  const { user } = useAuth()
  const [version, setVersion] = useState(0)
  const base = useScheduleBase(user?.id ?? null, version)

  if (!base.data) {
    return base.error ? <LoadError message={base.error} onRetry={base.reload} /> : <Loading label="Открываем расписание" />
  }
  return (
    <>
      {base.error && <LoadError message={base.error} onRetry={base.reload} />}
      <ScheduleScreen base={base.data} version={version} refresh={() => setVersion((v) => v + 1)} />
    </>
  )
}
