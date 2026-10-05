// --- Включение режима преподавателя ----------------------------------------
// Раньше здесь стояла заглушка «попроси владельца включить роль в SQL Editor» —
// то есть репетитор, пришедший сам, не мог начать вообще (A1 в docs/archive/mkt/19-fix-plan.md).
import { useEffect, useState } from 'react'
import { IconGraduation, IconBadgeCheck } from '../../shared/ui/icons'
import { BackHeader } from '../../shared/ui/BackButton'
import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { becomeTeacher } from '../../lib/teacher'
import { getMyPlan } from '../../lib/billing'

const TEACHER_PERKS = [
  'Привязываешь учеников по коду — они занимаются, ты видишь результат',
  'AI проверяет письменные работы, ты правишь вердикт, если не согласен',
  'Карта ошибок ученика: какие слова не держатся, какие темы валит',
  'Отчёт родителям на печать — в одну кнопку',
]

export function BecomeTeacher({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // число бесплатных мест живёт в БД (free_teacher_seats) — здесь только показываем
  const [freeSeats, setFreeSeats] = useState<number | null>(null)

  useEffect(() => {
    getMyPlan().then((p) => setFreeSeats(p?.free_seats ?? null))
  }, [])

  const enable = async () => {
    setBusy(true)
    setError(null)
    try {
      await becomeTeacher()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось включить режим')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <BackHeader onBack={onBack} title="Преподаватель" label="На главную" />
      <Card>
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-soft-fg">
            <IconGraduation size={22} />
          </span>
          <div>
            <h2 className="text-lg font-medium">Ведёшь учеников?</h2>
            <p className="mt-1 text-sm text-fg-secondary">
              Включи режим преподавателя — появится своя студия с кодом-приглашением.
            </p>
          </div>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {TEACHER_PERKS.map((p) => (
            <li key={p} className="flex gap-2.5 text-sm text-fg-secondary">
              <IconBadgeCheck size={17} className="mt-0.5 flex-none text-accent" />
              {p}
            </li>
          ))}
        </ul>

        {error && <p className="mt-4 text-sm text-danger-soft-fg">{error}</p>}

        <Button className="mt-5 w-full" onClick={enable} loading={busy}>
          Включить режим преподавателя
        </Button>
        <p className="mt-3 text-center text-xs text-fg-muted">
          Включается бесплатно и ничего не меняет в твоих собственных занятиях.
          Общий запас AI для студии и генерация материалов появляются, когда
          привяжешь первого ученика
          {freeSeats ? ` (на пробном периоде их до ${freeSeats})` : ''}.
        </p>
      </Card>
    </div>
  )
}
