import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconGraduation, IconFlame } from '../../components/icons'
import { BackHeader } from '../../components/BackButton'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { getProfile } from '../../lib/profile'
import { useAuth } from '../../context/AuthContext'
import {
  getOrCreateInviteCode,
  regenerateInviteCode,
  getMyStudents,
  getMyDecks,
  assignDeck,
  unassignDeck,
  type StudentInfo,
} from '../../lib/teacher'
import { MaterialsSection } from './MaterialsSection'
import { StudentWordsSection } from './StudentWordsSection'
import { QuestSection } from './QuestSection'
import { DiagnosticsSection } from './DiagnosticsSection'
import { PlacementSection } from './PlacementSection'
import { ProgramSection } from './ProgramSection'
import { DeckWordsPicker } from './DeckWordsPicker'
import { GuideSection } from './GuideSection'
import { DailyPlanSection } from './DailyPlanSection'
import { countSubmittedWorks } from '../../lib/materials'
import type { Deck, Profile } from '../../types'

export function TeacherPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    // кэш профиля — Главная и меню аватара уже запрашивали тот же ряд
    getProfile(user.id).then((p) => {
      setProfile(p)
      setLoading(false)
    })
  }, [user])

  if (loading) return <p className="text-[var(--night-text-40)]">Загрузка…</p>

  if (profile?.role !== 'teacher') {
    return (
      <div className="flex flex-col gap-4">
        <BackHeader onBack={() => navigate('/')} title="Преподаватель" label="На главную" />
        <Card>
          <p className="text-[var(--night-text-70)]">
            Этот раздел доступен только аккаунтам с ролью «преподаватель».
          </p>
          <p className="mt-2 text-sm text-[var(--night-text-40)]">
            Роль включается один раз в базе (Supabase → SQL Editor) — попроси
            владельца приложения.
          </p>
        </Card>
      </div>
    )
  }

  return <TeacherDashboard />
}

type TeacherTab = 'students' | 'materials' | 'guide'

function TeacherDashboard() {
  const [tab, setTab] = useState<TeacherTab>('students')
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [students, setStudents] = useState<StudentInfo[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [pendingWorks, setPendingWorks] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // «Загрузка…» только при первом открытии: при обновлениях список остаётся
  // на экране, иначе раскрытые колоды учениц схлопываются при каждом действии.
  const load = useCallback(async () => {
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
      countSubmittedWorks().then(setPendingWorks)
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

  // Перевыпуск кода: старый сразу перестаёт работать, уже привязанные ученицы
  // остаются. Спрашиваем подтверждение — действие необратимое.
  const changeCode = async () => {
    if (!confirm('Выдать новый код? Старый перестанет работать сразу. Уже привязанные ученицы останутся.')) {
      return
    }
    setRegenerating(true)
    setError(null)
    try {
      setCode(await regenerateInviteCode())
      setCopied(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сменить код')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Преподаватель</h1>
        {tab === 'students' && (
          <Button variant="ghost" className="px-3 py-1 text-sm" onClick={load}>
            Обновить
          </Button>
        )}
      </header>

      <div className="flex gap-2">
        {(
          [
            ['students', 'Ученицы'],
            ['materials', 'Материалы'],
            ['guide', 'Методичка'],
          ] as [TeacherTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              tab === id
                ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                : 'bg-white/[0.07] text-[var(--night-text-70)]'
            }`}
          >
            {label}
            {id === 'materials' && pendingWorks > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-amber-950">
                {pendingWorks}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'guide' ? (
        <GuideSection />
      ) : tab === 'materials' ? (
        <MaterialsSection students={students} />
      ) : (
        <>
          <Card>
            <p className="text-sm text-[var(--night-text-40)]">
              Код-приглашение — ученица вводит его у себя на Главной:
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="rounded-xl bg-white/[0.06] px-4 py-2 font-mono text-2xl font-bold tracking-widest dark:bg-white/[0.08]">
                {code ?? '……'}
              </span>
              <Button variant="secondary" className="px-3 py-2 text-sm" onClick={copyCode}>
                {copied ? 'Скопирован ✓' : 'Скопировать'}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                className="min-h-[44px] px-3 py-2 text-sm"
                loading={regenerating}
                onClick={changeCode}
              >
                Сменить код
              </Button>
              <span className="text-xs text-[var(--night-text-40)]">
                если код попал не тем — старый перестанет работать
              </span>
            </div>
          </Card>

          {error && (
            <Card className="border-red-300 bg-red-50 dark:bg-red-950/30">
              <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            </Card>
          )}

          {loading ? (
            <p className="text-[var(--night-text-40)]">Загрузка…</p>
          ) : students.length === 0 ? (
            <Card className="text-center">
              <IconGraduation size={40} className="mx-auto block text-[var(--night-text-40)]" />
              <p className="mt-2 font-semibold">Пока ни одной ученицы</p>
              <p className="mt-1 text-sm text-[var(--night-text-40)]">
                Отправь код-приглашение — после ввода кода ученица появится здесь.
              </p>
            </Card>
          ) : (
            students.map((s) => (
              <StudentCard key={s.profile.id} student={s} decks={decks} onChanged={load} />
            ))
          )}
        </>
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
  const [showWords, setShowWords] = useState(false)
  const [showQuests, setShowQuests] = useState(false)
  const [showDiag, setShowDiag] = useState(false)
  const [showProgram, setShowProgram] = useState(false)
  const [showPlanDay, setShowPlanDay] = useState(false)
  /** id набора, чьи слова сейчас раскрыты (просмотр + выборочное назначение). */
  const [openDeck, setOpenDeck] = useState<string | null>(null)
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
          <p className="text-sm text-[var(--night-text-40)]">
            Уровень {p.level} · <IconFlame size={13} className="inline align-text-bottom" />{' '}
            {student.streak} ·{' '}
            {student.doneToday ? 'сегодня ✓' : 'сегодня —'}
          </p>
        </div>
        <p className="text-right text-sm text-[var(--night-text-40)]">
          за 7 дней:
          <br />
          <span className="text-lg font-bold text-[var(--night-text-70)]">
            {student.weekItems}
          </span>{' '}
          заданий
        </p>
      </div>

      <button
        onClick={() => setShowDecks((v) => !v)}
        className="text-left text-sm font-medium text-[var(--night-accent-text)] hover:underline dark:text-[var(--night-accent-text)]"
      >
        {showDecks ? '▾ Скрыть наборы слов' : `▸ Наборы слов (назначено: ${student.assignedDeckIds.length})`}
      </button>

      {showDecks && (
        <div className="flex flex-col gap-2">
          {decks.map((d) => {
            const assigned = student.assignedDeckIds.includes(d.id)
            const opened = openDeck === d.id
            return (
              <div
                key={d.id}
                className="flex flex-col gap-2 rounded-xl border border-white/[0.08] px-3 py-2 dark:border-white/[0.08]"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* тап по названию раскрывает слова — назначение больше не вслепую */}
                  <button
                    onClick={() => setOpenDeck(opened ? null : d.id)}
                    className="min-h-[44px] min-w-0 flex-1 text-left text-sm font-medium"
                    aria-expanded={opened}
                  >
                    <span className="truncate">{d.title}</span>{' '}
                    <span className="text-xs text-[var(--night-text-40)]">
                      ({d.lang ?? 'en'}) {opened ? '▾' : '▸ слова'}
                    </span>
                  </button>
                  <Button
                    variant={assigned ? 'ghost' : 'secondary'}
                    className="shrink-0 px-3 py-1.5 text-sm"
                    disabled={busyDeck !== null}
                    onClick={() => toggleDeck(d)}
                  >
                    {busyDeck === d.id ? '…' : assigned ? 'Убрать ✓' : 'Назначить'}
                  </Button>
                </div>
                {opened && (
                  <DeckWordsPicker
                    deck={d}
                    studentId={p.id}
                    studentName={p.display_name ?? 'ученицы'}
                    onAssigned={onChanged}
                  />
                )}
              </div>
            )
          })}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      )}

      <button
        onClick={() => setShowDiag((v) => !v)}
        className="text-left text-sm font-medium text-[var(--night-accent-text)] hover:underline dark:text-[var(--night-accent-text)]"
      >
        {showDiag ? '▾ Скрыть диагностику' : '▸ Диагностическая карта'}
      </button>
      {showDiag && (
        <DiagnosticsSection studentId={p.id} studentName={p.display_name ?? 'Ученица'} />
      )}

      {/* тест уровня — своя раскрывашка: нужна в первую очередь с новой
          ученицей, когда уровень ещё неизвестен */}
      <PlacementSection studentId={p.id} studentName={p.display_name ?? 'ученица'} />

      <button
        onClick={() => setShowPlanDay((v) => !v)}
        className="text-left text-sm font-medium text-[var(--night-accent-text)] hover:underline dark:text-[var(--night-accent-text)]"
      >
        {showPlanDay ? '▾ Скрыть план дня' : '▸ План дня'}
      </button>
      {showPlanDay && <DailyPlanSection studentId={p.id} />}

      <button
        onClick={() => setShowProgram((v) => !v)}
        className="text-left text-sm font-medium text-[var(--night-accent-text)] hover:underline dark:text-[var(--night-accent-text)]"
      >
        {showProgram ? '▾ Скрыть программу' : '▸ Программа обучения'}
      </button>
      {showProgram && <ProgramSection studentId={p.id} />}

      <button
        onClick={() => setShowWords((v) => !v)}
        className="text-left text-sm font-medium text-[var(--night-accent-text)] hover:underline dark:text-[var(--night-accent-text)]"
      >
        {showWords ? '▾ Скрыть слова' : '▸ Слова и перепроверка'}
      </button>
      {showWords && <StudentWordsSection studentId={p.id} />}

      <button
        onClick={() => setShowQuests((v) => !v)}
        className="text-left text-sm font-medium text-[var(--night-accent-text)] hover:underline dark:text-[var(--night-accent-text)]"
      >
        {showQuests ? '▾ Скрыть AI-квесты' : '▸ AI-квесты по грамматике'}
      </button>
      {showQuests && <QuestSection studentId={p.id} />}
    </Card>
  )
}
