import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { RowCard } from '../../shared/ui/RowCard'
import { TextField } from '../../shared/ui/TextField'
import { IconKey } from '../../shared/ui/icons'
import { joinTeacher } from '../../lib/teacher'
import { pendingJoin } from '../../lib/pendingRole'
import { getMyAssignments } from '../../lib/materials'
import type { Profile } from '../../types'

/** Сколько заданий у ученика всего и сколько ещё не сдано. */
export interface AssignmentCounts {
  total: number
  pending: number
}

/** Загрузка счётчиков для Главной: пункт «Задание от преподавателя» в плане дня. */
export async function loadAssignmentCounts(): Promise<AssignmentCounts> {
  // сбой связи — исключение, а не «0 заданий»: Главная скажет о связи (Ф1.13)
  const rows = await getMyAssignments()
  return {
    total: rows.length,
    pending: rows.filter((r) => r.status === 'assigned').length,
  }
}

/**
 * «Занимаешься с преподавателем?» на Главной самоучки (макеты u1-3, d4-v2-3):
 * тихая строка внизу, по нажатию — код и «Привязать». Пришёл по ссылке-
 * приглашению (Ф2.5) — форма открыта, код уже в поле. Ученику с
 * преподавателем и репетитору — ничего: преподаватель виден в домашке и
 * уроке, студия — вкладки меню (PLAN.md Ф2.10). `teachers` грузит Главная
 * в своём первом кадре (null — не знаем, и строку не показываем).
 */
export function TeacherBlock({
  profile,
  teachers,
  compact = false,
}: {
  profile: Profile | null
  teachers: Profile[] | null
  compact?: boolean
}) {
  const [invited] = useState(() => pendingJoin())
  const [open, setOpen] = useState(invited !== null)
  const [code, setCode] = useState(invited ?? '')
  const [busy, setBusy] = useState(false)
  const [joined, setJoined] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // По приглашению строка внизу Главной — показать её сразу, один раз
  const box = useRef<HTMLDivElement>(null)
  const scrolled = useRef(false)
  useEffect(() => {
    if (!invited || teachers === null || scrolled.current) return
    scrolled.current = true
    box.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [invited, teachers])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      setJoined(await joinTeacher(code))
      setCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось привязаться')
    } finally {
      setBusy(false)
    }
  }

  if (!profile || profile.role === 'teacher' || teachers === null) return null
  if (joined) {
    return (
      <Card className="text-body text-fg-secondary">
        Готово! Твой преподаватель: <span className="font-semibold text-fg">{joined}</span>
      </Card>
    )
  }
  if (teachers.length > 0) return null

  if (!open) {
    return (
      <RowCard
        lead={<IconKey size={22} aria-hidden className="flex-none text-accent-strong" />}
        title="Занимаешься с преподавателем?"
        desc="Открой его ссылку или введи код"
        onClick={() => setOpen(true)}
        outline={!compact}
      />
    )
  }

  return (
    <div ref={box}>
      <Card className="flex flex-col gap-3">
        <p className="font-semibold text-fg">{invited ? 'Тебя пригласил преподаватель' : 'Код преподавателя'}</p>
        <form onSubmit={submit} className="flex items-end gap-2">
          <TextField
            label="Код из 6 символов"
            className="min-w-0 flex-1"
            placeholder="КОД"
            value={code}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            error={error ?? undefined}
            showError={!!error}
          />
          <Button type="submit" loading={busy} disabled={!code.trim()}>
            Привязать
          </Button>
        </form>
        {invited && code === invited && !error && (
          <p className="text-note text-fg-muted" data-join-prefilled>
            Код из приглашения преподавателя — нажми «Привязать».
          </p>
        )}
      </Card>
    </div>
  )
}
