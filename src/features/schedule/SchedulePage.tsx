// ============================================================================
// Адрес /schedule (PLAN.md Ф2.7): расписание репетитора — первая вкладка
// меню учителя и его стартовый экран (Ф2.10). Кто сюда пускается — таблица
// маршрутов (роль teacher): не-репетитору — приглашение «Ведёшь учеников?»,
// экран сам роль не проверяет.
// ============================================================================
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useOnReturn } from '../../shared/lib/useOnReturn'
import { LoadError } from '../../shared/ui/LoadError'
import { Loading } from '../../shared/ui/Loading'
import { ScheduleScreen } from './ScheduleScreen'
import { useScheduleBase } from './useScheduleData'

export function SchedulePage() {
  const { user } = useAuth()
  const [version, setVersion] = useState(0)
  const base = useScheduleBase(user?.id ?? null, version)
  // перенос или отмена с другого устройства, ответ ученика — пока приложение
  // было свёрнуто: вернулся — расписание перечитывается само
  useOnReturn(() => setVersion((v) => v + 1))

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
