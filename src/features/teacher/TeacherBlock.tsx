import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { joinTeacher, getMyTeachers } from '../../lib/teacher'
import type { Profile } from '../../types'

/**
 * Блок «Преподаватель» на Главной (Фаза 4).
 * Преподавателю — ссылка на экран учениц; ученице — привязка по коду
 * и имя её преподавателя, когда привязка уже есть.
 */
export function TeacherBlock({ profile }: { profile: Profile | null }) {
  if (!profile) return null
  if (profile.role === 'teacher') {
    return (
      <Link to="/teacher">
        <Card className="flex items-center justify-between transition-transform active:scale-[0.99]">
          <div>
            <p className="font-semibold">👩‍🏫 Мои ученицы</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Код-приглашение, колоды, прогресс
            </p>
          </div>
          <span className="text-slate-400">→</span>
        </Card>
      </Link>
    )
  }
  return <JoinTeacherBlock />
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
        <p className="text-sm text-slate-500 dark:text-slate-400">
          👩‍🏫 Преподаватель:{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-200">
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
          className="text-left text-sm text-sky-600 hover:underline dark:text-sky-400"
        >
          У меня есть код преподавателя →
        </button>
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase tracking-widest outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900"
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
