import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { joinTeacher, getMyTeachers } from '../../lib/teacher'
import { pendingJoin } from '../../lib/pendingRole'
import { getMyAssignments } from '../../lib/materials'
import type { Profile } from '../../types'
import { AppLink } from '../../shared/ui/AppLink'

/** Сколько заданий у ученика всего и сколько ещё не сдано. */
export interface AssignmentCounts {
  total: number
  pending: number
}

/** Загрузка счётчиков для Главной (см. AssignmentsNotice — она их только рисует). */
export async function loadAssignmentCounts(): Promise<AssignmentCounts> {
  // сбой связи — исключение, а не «0 заданий»: Главная скажет о связи (Ф1.13)
  const rows = await getMyAssignments()
  return {
    total: rows.length,
    pending: rows.filter((r) => r.status === 'assigned').length,
  }
}

/**
 * Блок «Преподаватель» на Главной ученика: привязка по коду и имя его
 * преподавателя, когда привязка уже есть. Репетитору — ничего: Главной у
 * него нет (старт — расписание), студия — вкладки меню (PLAN.md Ф2.10).
 * Раньше здесь была карточка «Преподаватель» со счётчиком работ — теперь
 * число «ждут проверки» стоит на вкладке «Задания».
 */
export function TeacherBlock({ profile }: { profile: Profile | null }) {
  if (!profile || profile.role === 'teacher') return null
  // AssignmentsNotice здесь больше нет: Главная рендерит её сама, и раньше
  // плашка «Все задания выполнены» показывалась дважды подряд.
  return <JoinTeacherBlock />
}

/**
 * Уведомление «Задания от преподавателя» у ученика.
 * placement="top" — заметная плашка под стриком, ТОЛЬКО пока есть несданные;
 * placement="bottom" — спокойная карточка внизу, когда всё сдано (для доступа
 * к выполненным работам и разборам).
 */
export function AssignmentsNotice({
  placement,
  counts,
}: {
  placement: 'top' | 'bottom'
  /** Считает и передаёт родитель: компонент рендерится дважды (top и bottom),
   *  и своя загрузка означала два одинаковых запроса на каждой Главной. */
  counts: AssignmentCounts | null
}) {
  if (!counts || counts.total === 0) return null
  if (placement === 'top' && counts.pending === 0) return null
  if (placement === 'bottom' && counts.pending > 0) return null

  if (placement === 'top') {
    return (
      <AppLink to="/assignments">
        <Card tone="warning" className="flex items-center justify-between transition-transform active:scale-[0.99]">
          <div>
            <p className="font-semibold text-warning-soft-fg">
              Новое задание от преподавателя
            </p>
            <p className="text-sm text-warning-strong/80">
              {counts.pending === 1
                ? 'Тебя ждёт 1 задание'
                : `Тебя ждут задания: ${counts.pending}`}
            </p>
          </div>
          <span className="rounded-full bg-warning px-2.5 py-1 text-sm font-bold text-warning-fg">
            {counts.pending}
          </span>
        </Card>
      </AppLink>
    )
  }

  return (
    <AppLink to="/assignments">
      <Card className="flex items-center justify-between transition-transform active:scale-[0.99]">
        <div>
          <p className="font-semibold">Задания от преподавателя</p>
          <p className="text-sm text-fg-muted">
            Все задания выполнены ✓
          </p>
        </div>
        <span className="text-fg-muted">→</span>
      </Card>
    </AppLink>
  )
}

function JoinTeacherBlock() {
  const [teachers, setTeachers] = useState<Profile[] | null>(null)
  // пришёл по ссылке-приглашению (Ф2.5) — код уже в поле, остаётся нажать
  const [invited] = useState(() => pendingJoin())
  const [open, setOpen] = useState(invited !== null)
  const [code, setCode] = useState(invited ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMyTeachers()
      .then(setTeachers)
      .catch(() => setTeachers([]))
  }, [])

  // По приглашению блок внизу Главной — показать его сразу, один раз
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
    setMsg(null)
    try {
      const name = await joinTeacher(code)
      setMsg(`Готово! Твой преподаватель: ${name}`)
      setCode('')
      setOpen(false)
      setTeachers(await getMyTeachers())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось привязаться')
    } finally {
      setBusy(false)
    }
  }

  // ничего не показываем, пока не знаем состояние — чтобы блок не «мигал»
  if (teachers === null) return null

  if (teachers.length > 0 && !open) {
    return (
      <Card className="flex items-center justify-between">
        <p className="text-sm text-fg-muted">
          Преподаватель:{' '}
          <span className="font-semibold text-fg-secondary">
            {teachers.map((t) => t.display_name ?? 'Без имени').join(', ')}
          </span>
        </p>
        {msg && <span className="text-sm text-success">✓</span>}
      </Card>
    )
  }

  return (
    <div ref={box}>
      <Card className="flex flex-col gap-2">
        {open && invited && <p className="font-semibold">Тебя пригласил преподаватель</p>}
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="flex min-h-[44px] items-center text-left text-sm text-accent-strong hover:underline"
          >
            У меня есть код преподавателя →
          </button>
        ) : (
          <form onSubmit={submit} className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-tint/[0.10] bg-input px-3 py-2 font-mono text-sm uppercase tracking-widest outline-none focus:border-accent-line"
              placeholder="КОД (6 символов)"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <Button type="submit" className="px-3 py-2 text-sm" disabled={busy || !code.trim()}>
              {busy ? '…' : 'Привязать'}
            </Button>
          </form>
        )}
        {open && invited && code === invited && !error && (
          <p className="text-sm text-fg-muted" data-join-prefilled>
            Код из приглашения преподавателя — нажми «Привязать».
          </p>
        )}
        {msg && <p className="text-sm text-success">{msg}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
      </Card>
    </div>
  )
}
