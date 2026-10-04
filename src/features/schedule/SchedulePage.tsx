// ============================================================================
// Адрес /schedule (PLAN.md Ф2.7): расписание репетитора. До меню учителя
// (Ф2.10) сюда ведёт вкладка «Расписание» в студии, с Ф2.10 — это первая
// вкладка и стартовый экран учителя. Не репетитору — объяснение и вход в
// студию, а не пустое расписание.
// ============================================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../shared/ui/Button'
import { EmptyState } from '../../shared/ui/EmptyState'
import { IconCalendar } from '../../shared/ui/icons'
import { LoadError } from '../../shared/ui/LoadError'
import { Loading } from '../../shared/ui/Loading'
import { ScheduleScreen } from './ScheduleScreen'
import { useScheduleBase } from './useScheduleData'

export function SchedulePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [version, setVersion] = useState(0)
  const base = useScheduleBase(user?.id ?? null, version)

  if (!base.data) {
    return base.error ? <LoadError message={base.error} onRetry={base.reload} /> : <Loading label="Открываем расписание" />
  }
  if (!base.data.teacher) {
    return (
      <EmptyState
        Icon={IconCalendar}
        title="Расписание — у репетиторов"
        actions={<Button onClick={() => navigate('/teacher')}>Перейти в студию</Button>}
      >
        Включи режим преподавателя — появятся ученики, уроки и учёт оплаченных.
      </EmptyState>
    )
  }
  return (
    <>
      {base.error && <LoadError message={base.error} onRetry={base.reload} />}
      <ScheduleScreen base={base.data} version={version} refresh={() => setVersion((v) => v + 1)} />
    </>
  )
}
