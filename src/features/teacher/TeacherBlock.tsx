import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { joinTeacher, getMyTeachers } from '../../lib/teacher'
import { countSubmittedWorks, getMyAssignments } from '../../lib/materials'
import type { Profile } from '../../types'

/**
 * Блок «Преподаватель» на Главной (Фаза 4).
 * Преподавателю — ссылка на экран учениц; ученице — привязка по коду
 * и имя её преподавателя, когда привязка уже есть.
 */
export function TeacherBlock({ profile }: { profile: Profile | null }) {
  if (!profile) return null
  if (profile.role === 'teacher') {
    return <TeacherCard />
  }
  return (
    <>
      <AssignmentsNotice placement="bottom" />
      <JoinTeacherBlock />
    </>
  )
}

/** Карточка преподавателя: ссылка на экран + уведомление о сданных работах. */
function TeacherCard() {
  const [pending, setPending] = useState(0)

  useEffect(() => {
    countSubmittedWorks().then(setPending).catch(() => {})
  }, [])

  return (
    <Link to="/teacher">
      <Card className="flex items-center justify-between transition-transform active:scale-[0.99]">
        <div>
          <p className="font-semibold">👩‍🏫 Мои ученицы</p>
          <p className="text-sm text-[var(--night-text-40)]">
            {pending > 0
              ? `Работ на проверку: ${pending}`
              : 'Код-приглашение, колоды, материалы, прогресс'}
          </p>
        </div>
        {pending > 0 ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
            {pending}
          </span>
        ) : (
          <span className="text-[var(--night-text-40)]">→</span>
        )}
      </Card>
    </Link>
  )
}

/**
 * Уведомление «Задания от преподавателя» у ученицы.
 * placement="top" — заметная плашка под стриком, ТОЛЬКО пока есть несданные;
 * placement="bottom" — спокойная карточка внизу, когда всё сдано (для доступа
 * к выполненным работам и разборам).
 */
export function AssignmentsNotice({ placement }: { placement: 'top' | 'bottom' }) {
  const [counts, setCounts] = useState<{ total: number; pending: number } | null>(null)

  useEffect(() => {
    getMyAssignments()
      .then((rows) =>
        setCounts({
          total: rows.length,
          pending: rows.filter((r) => r.status === 'assigned').length,
        }),
      )
      .catch(() => setCounts({ total: 0, pending: 0 }))
  }, [])

  if (!counts || counts.total === 0) return null
  if (placement === 'top' && counts.pending === 0) return null
  if (placement === 'bottom' && counts.pending > 0) return null

  if (placement === 'top') {
    return (
      <Link to="/assignments">
        <Card className="flex items-center justify-between border-amber-300 bg-amber-50 transition-transform active:scale-[0.99] dark:border-amber-700 dark:bg-amber-950/30">
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              📝 Новое задание от преподавателя
            </p>
            <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
              {counts.pending === 1
                ? 'Тебя ждёт 1 задание'
                : `Тебя ждут задания: ${counts.pending}`}
            </p>
          </div>
          <span className="rounded-full bg-amber-400 px-2.5 py-1 text-sm font-bold text-amber-950">
            {counts.pending}
          </span>
        </Card>
      </Link>
    )
  }

  return (
    <Link to="/assignments">
      <Card className="flex items-center justify-between transition-transform active:scale-[0.99]">
        <div>
          <p className="font-semibold">📝 Задания от преподавателя</p>
          <p className="text-sm text-[var(--night-text-40)]">
            Все задания выполнены ✓
          </p>
        </div>
        <span className="text-[var(--night-text-40)]">→</span>
      </Card>
    </Link>
  )
}

function JoinTeacherBlock() {
  const [teachers, setTeachers] = useState<Profile[] | null>(null)
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMyTeachers()
      .then(setTeachers)
      .catch(() => setTeachers([]))
  }, [])

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
        <p className="text-sm text-[var(--night-text-40)]">
          👩‍🏫 Преподаватель:{' '}
          <span className="font-semibold text-[var(--night-text-70)]">
            {teachers.map((t) => t.display_name ?? 'Без имени').join(', ')}
          </span>
        </p>
        {msg && <span className="text-sm text-emerald-600">✓</span>}
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-2">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-left text-sm text-[var(--night-accent-text)] hover:underline dark:text-[var(--night-accent-text)]"
        >
          У меня есть код преподавателя →
        </button>
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-white/[0.10] bg-[var(--night-surface)] px-3 py-2 font-mono text-sm uppercase tracking-widest outline-none focus:border-[var(--night-accent-45)] dark:border-white/[0.10] dark:bg-slate-900"
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
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </Card>
  )
}
