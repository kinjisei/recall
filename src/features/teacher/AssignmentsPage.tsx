// ============================================================================
// «Задания» ученицы: назначенные преподавателем материалы — текст + упражнения.
// Прохождение: чтение → упражнения (общий движок) → сдача (авто-балл, статус
// submitted). Проверка преподавателем — следующая фаза фичи.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { ExerciseView } from '../../components/exercises'
import { logActivity } from '../../lib/activity'
import {
  getMyAssignments,
  submitAssignment,
} from '../../lib/materials'
import type {
  AssignmentAnswer,
  Material,
  MaterialAssignment,
} from '../../types'

type Row = MaterialAssignment & { material: Material }

export function AssignmentsPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [active, setActive] = useState<Row | null>(null)

  const reload = useCallback(() => {
    getMyAssignments().then(setRows).catch(() => setRows([]))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  if (active) {
    return (
      <AssignmentRunner
        row={active}
        onDone={() => {
          setActive(null)
          reload()
        }}
        onBack={() => setActive(null)}
      />
    )
  }

  const pending = (rows ?? []).filter((r) => r.status === 'assigned')
  const done = (rows ?? []).filter((r) => r.status !== 'assigned')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
          ← Главная
        </Link>
        <h1 className="text-2xl font-bold">📝 Задания</h1>
      </div>

      {rows === null ? (
        <p className="text-slate-500">Загрузка…</p>
      ) : rows.length === 0 ? (
        <Card className="text-center">
          <p className="text-4xl">🌤</p>
          <p className="mt-2 font-semibold">Заданий пока нет</p>
          <p className="mt-1 text-sm text-slate-500">
            Когда преподаватель назначит задание, оно появится здесь.
          </p>
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-slate-500">Новые</h2>
              {pending.map((r) => (
                <AssignmentCard key={r.id} row={r} onOpen={() => setActive(r)} />
              ))}
            </section>
          )}
          {done.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-slate-500">Выполненные</h2>
              {done.map((r) => (
                <AssignmentCard key={r.id} row={r} onOpen={() => setActive(r)} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}

function AssignmentCard({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const m = row.material
  return (
    <button onClick={onOpen} className="text-left">
      <Card className="flex items-center justify-between gap-2 transition-transform active:scale-[0.99]">
        <div className="min-w-0">
          <p className="truncate font-medium">{m.title ?? m.topic}</p>
          <p className="text-xs text-slate-400">
            {m.lang.toUpperCase()} · {m.level} · {m.format} · {m.exercises.length} упр.
          </p>
        </div>
        <span className="shrink-0 text-sm">
          {row.status === 'assigned' ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              новое
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400">
              {row.auto_score}/{row.auto_total}
            </span>
          )}
        </span>
      </Card>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Прохождение задания: текст → упражнения → сдача.
// ---------------------------------------------------------------------------

function AssignmentRunner({
  row,
  onDone,
  onBack,
}: {
  row: Row
  onDone: () => void
  onBack: () => void
}) {
  const m = row.material
  const [stage, setStage] = useState<'read' | 'exercises' | 'result'>('read')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<AssignmentAnswer[]>([])
  const [correct, setCorrect] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const alreadyDone = row.status !== 'assigned'
  const total = m.exercises.length
  const current = m.exercises[index]

  // ответ на текущее упражнение (ok приходит из onAnswered, given — из onGiven)
  const pendingRef = useState<{ ok: boolean; given: string }>({ ok: false, given: '' })[0]

  const onAnswered = (ok: boolean) => {
    pendingRef.ok = ok
    if (ok) setCorrect((c) => c + 1)
  }
  const onGiven = (given: string) => {
    pendingRef.given = given
    setAnswers((arr) => [
      ...arr,
      { index, given, auto_ok: pendingRef.ok },
    ])
  }

  const next = () => {
    if (index + 1 >= total) {
      void finish()
    } else {
      setIndex((i) => i + 1)
    }
  }

  const finish = async () => {
    setStage('result')
    if (alreadyDone) return
    setSaving(true)
    try {
      await submitAssignment(row.id, answers, correct, total)
      void logActivity('assignment')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Не удалось отправить работу')
    } finally {
      setSaving(false)
    }
  }

  if (stage === 'read') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
            ← Задания
          </Button>
          <h1 className="min-w-0 truncate text-xl font-bold">{m.title ?? m.topic}</h1>
        </div>
        <Card>
          <p className="text-xs text-slate-400">
            {m.level} · {m.format} · прочитай внимательно — упражнения по тексту
          </p>
          <p className="mt-3 whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-200">
            {m.body}
          </p>
        </Card>
        <Button onClick={() => setStage('exercises')}>
          {alreadyDone ? 'Пройти ещё раз (без пересдачи) →' : `К упражнениям (${total}) →`}
        </Button>
        {alreadyDone && (
          <p className="text-center text-xs text-slate-400">
            Работа уже сдана ({row.auto_score}/{row.auto_total}) — повторное прохождение не отправляется.
          </p>
        )}
      </div>
    )
  }

  if (stage === 'result') {
    const percent = total ? Math.round((correct / total) * 100) : 0
    return (
      <Card className="text-center">
        <p className="text-4xl">{percent >= 80 ? '🎉' : percent >= 50 ? '👍' : '💪'}</p>
        <p className="mt-2 text-lg font-bold">
          {correct} из {total} верно ({percent}%)
        </p>
        {!alreadyDone && (
          <p className="mt-1 text-sm text-slate-500">
            {saving
              ? 'Отправляю работу преподавателю…'
              : saveError
                ? saveError
                : 'Работа отправлена преподавателю на проверку ✓'}
          </p>
        )}
        <Button className="mt-4" onClick={onDone}>
          К заданиям
        </Button>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-slate-400">
        <button onClick={() => setStage('read')} className="font-medium text-sky-600 hover:underline dark:text-sky-400">
          ↑ перечитать текст
        </button>
        <span>
          {index + 1} / {total} · верно: {correct}
        </span>
      </div>
      <ExerciseView
        key={index}
        exercise={current}
        onAnswered={onAnswered}
        onGiven={onGiven}
        onNext={next}
        isLast={index + 1 >= total}
      />
    </div>
  )
}
