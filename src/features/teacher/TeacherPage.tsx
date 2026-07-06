import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  getOrCreateInviteCode,
  getMyStudents,
  getMyDecks,
  assignDeck,
  unassignDeck,
  type StudentInfo,
} from '../../lib/teacher'
import type { Deck, Profile } from '../../types'

export function TeacherPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setProfile(data as Profile | null)
        setLoading(false)
      })
  }, [user])

  if (loading) return <p className="text-slate-500">Загрузка…</p>

  if (profile?.role !== 'teacher') {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">👩‍🏫 Преподаватель</h1>
        <Card>
          <p className="text-slate-600 dark:text-slate-300">
            Этот раздел доступен только аккаунтам с ролью «преподаватель».
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Роль включается один раз в базе (Supabase → SQL Editor) — попроси
            владельца приложения.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm text-sky-600 hover:underline">
            ← На главную
          </Link>
        </Card>
      </div>
    )
  }

  return <TeacherDashboard />
}

function TeacherDashboard() {
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [students, setStudents] = useState<StudentInfo[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, s, d] = await Promise.all([
        getOrCreateInviteCode(),
        getMyStudents(),
        getMyDecks(),
      ])
      setCode(c)
      setStudents(s)
      setDecks(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const copyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* нет доступа к буферу — код виден на экране */
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">👩‍🏫 Мои ученицы</h1>
        <Button variant="ghost" className="px-3 py-1 text-sm" onClick={load}>
          Обновить
        </Button>
      </header>

      <Card>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Код-приглашение — ученица вводит его у себя на Главной:
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className="rounded-xl bg-slate-100 px-4 py-2 font-mono text-2xl font-bold tracking-widest dark:bg-slate-700">
            {code ?? '……'}
          </span>
          <Button variant="secondary" className="px-3 py-2 text-sm" onClick={copyCode}>
            {copied ? 'Скопирован ✓' : 'Скопировать'}
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/30">
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        </Card>
      )}

      {loading ? (
        <p className="text-slate-500">Загрузка…</p>
      ) : students.length === 0 ? (
        <Card className="text-center">
          <p className="text-4xl">🎓</p>
          <p className="mt-2 font-semibold">Пока ни одной ученицы</p>
          <p className="mt-1 text-sm text-slate-500">
            Отправь код-приглашение — после ввода кода ученица появится здесь.
          </p>
        </Card>
      ) : (
        students.map((s) => (
          <StudentCard key={s.profile.id} student={s} decks={decks} onChanged={load} />
        ))
      )}
    </div>
  )
}

function StudentCard({
  student,
  decks,
  onChanged,
}: {
  student: StudentInfo
  decks: Deck[]
  onChanged: () => void
}) {
  const [showDecks, setShowDecks] = useState(false)
  const [busyDeck, setBusyDeck] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const p = student.profile

  const toggleDeck = async (deck: Deck) => {
    setBusyDeck(deck.id)
    setError(null)
    try {
      if (student.assignedDeckIds.includes(deck.id)) {
        await unassignDeck(deck.id, p.id)
      } else {
        await assignDeck(deck.id, p.id)
      }
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить назначение')
    } finally {
      setBusyDeck(null)
    }
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{p.display_name ?? 'Без имени'}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Уровень {p.level} · 🔥 {student.streak} ·{' '}
            {student.doneToday ? 'сегодня ✓' : 'сегодня —'}
          </p>
        </div>
        <p className="text-right text-sm text-slate-500 dark:text-slate-400">
          за 7 дней:
          <br />
          <span className="text-lg font-bold text-slate-700 dark:text-slate-200">
            {student.weekItems}
          </span>{' '}
          заданий
        </p>
      </div>

      <button
        onClick={() => setShowDecks((v) => !v)}
        className="text-left text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
      >
        {showDecks ? '▾ Скрыть колоды' : `▸ Колоды (назначено: ${student.assignedDeckIds.length})`}
      </button>

      {showDecks && (
        <div className="flex flex-col gap-2">
          {decks.map((d) => {
            const assigned = student.assignedDeckIds.includes(d.id)
            return (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700"
              >
                <p className="min-w-0 truncate text-sm font-medium">
                  {d.title}{' '}
                  <span className="text-xs text-slate-400">({d.lang ?? 'en'})</span>
                </p>
                <Button
                  variant={assigned ? 'ghost' : 'secondary'}
                  className="shrink-0 px-3 py-1.5 text-sm"
                  disabled={busyDeck !== null}
                  onClick={() => toggleDeck(d)}
                >
                  {busyDeck === d.id ? '…' : assigned ? 'Убрать ✓' : 'Назначить'}
                </Button>
              </div>
            )
          })}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}
    </Card>
  )
}
