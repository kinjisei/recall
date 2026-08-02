// ============================================================================
// «Письмо» у ученицы (Заход 5b): список назначенных заданий → написание → AI-оценка
// → показ результата. Можно САМОЙ править и пересдавать, пока учитель не проверил
// (каждая сдача — своя heavy-оценка, пишется в историю attempts на сервере).
// Проверка учителем и история попыток крупным планом — Заход 5c.
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { BackButton, BackHeader } from '../../components/BackButton'
import { LoadError } from '../../components/LoadError'
import { useScrollTop } from '../../lib/useScrollTop'
import { getMyWritingAssignments, submitWriting } from '../../lib/writing'
import { gradeWriting, bandLabel } from '../../lib/writingGrade'
import type { WritingGrade, WritingTask, WritingTaskAssignment } from '../../types'
import { WritingGradeView } from './WritingGradeView'
import { WritingHistory } from './WritingHistory'

type Row = WritingTaskAssignment & { task: WritingTask }

export function WritingPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const navigate = useNavigate()
  useScrollTop(activeId ?? 'list')

  const load = () => {
    setError(null)
    getMyWritingAssignments()
      .then(setRows)
      .catch(() => setError('Не удалось загрузить задания'))
  }
  useEffect(load, [])

  const active = rows?.find((r) => r.id === activeId) ?? null

  if (active) {
    return (
      <WritingRunner
        row={active}
        onBack={() => setActiveId(null)}
        onChanged={load}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-4">
      <div className="flex items-center gap-3">
        <BackButton onClick={() => navigate('/study')} />
        <h1 className="text-xl font-bold">Письменные задания</h1>
      </div>

      {error ? (
        <LoadError message={error} onRetry={load} />
      ) : rows === null ? (
        <p className="text-sm text-[var(--night-text-40)]">Загрузка…</p>
      ) : rows.length === 0 ? (
        <Card className="text-center">
          <p className="font-semibold">Заданий пока нет</p>
          <p className="mt-1 text-sm text-[var(--night-text-40)]">
            Преподаватель назначит письмо — оно появится здесь.
          </p>
        </Card>
      ) : (
        rows.map((r) => {
          const st =
            r.status === 'assigned'
              ? 'новое'
              : r.status === 'submitted'
                ? `сдано${r.band ? ` · ${r.band}` : ''}`
                : `✓ проверено${r.band ? ` · ${r.band}` : ''}`
          return (
            <button
              key={r.id}
              onClick={() => setActiveId(r.id)}
              className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] px-3 py-3 text-left transition-transform active:scale-[0.99]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.task.prompt}</p>
                <p className="text-xs text-[var(--night-text-40)]">
                  {r.task.mode === 'ielts'
                    ? `IELTS · ${r.task.settings?.ieltsTask === 'gt1' ? 'GT Task 1' : 'Task 2'}`
                    : `Эссе · ${r.task.level}`}{' '}
                  · {st}
                </p>
              </div>
            </button>
          )
        })
      )}
    </div>
  )
}

function WritingRunner({
  row,
  onBack,
  onChanged,
}: {
  row: Row
  onBack: () => void
  onChanged: () => void
}) {
  const task = row.task
  const reviewed = row.status === 'reviewed'
  const [essay, setEssay] = useState(row.essay ?? '')
  const [grade, setGrade] = useState<WritingGrade | null>(row.ai_review ?? null)
  const [editing, setEditing] = useState(row.status === 'assigned')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const words = useMemo(() => essay.trim().split(/\s+/).filter(Boolean).length, [essay])
  const minWords = task.settings?.minWords ?? 0
  const tooShort = minWords > 0 && words < minWords

  const submit = async () => {
    const body = essay.trim()
    if (!body || busy) return
    setBusy(true)
    setError(null)
    try {
      const g = await gradeWriting(task, body, task.lang)
      await submitWriting(row.id, body, g, bandLabel(task.mode, g))
      setGrade(g)
      setEditing(false)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось оценить работу')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-4">
      <BackHeader onBack={onBack} title="Письмо" label="К списку" />

      <Card>
        <p className="text-xs text-[var(--night-text-40)]">
          {task.mode === 'ielts'
            ? `IELTS · ${task.settings?.ieltsTask === 'gt1' ? 'GT Task 1' : 'Task 2'}${
                task.settings?.targetBand ? ` · цель band ${task.settings.targetBand}` : ''
              }`
            : `Эссе · ${task.lang === 'es' ? 'испанский' : 'английский'} · ${task.level}`}
        </p>
        <p className="mt-2 whitespace-pre-wrap leading-relaxed">{task.prompt}</p>
        {task.mode === 'regular' && task.settings?.targetWords?.length ? (
          <p className="mt-2 text-xs text-[var(--night-text-40)]">
            Постарайся употребить: {task.settings.targetWords.join(', ')}
          </p>
        ) : null}
        {row.note && (
          <p className="mt-2 rounded-lg bg-white/[0.05] px-3 py-2 text-sm text-[var(--night-text-70)]">
            От преподавателя: {row.note}
          </p>
        )}
      </Card>

      {editing ? (
        <>
          <textarea
            className="min-h-[220px] w-full rounded-2xl border border-white/[0.10] bg-[var(--night-input)] px-3 py-3 leading-relaxed outline-none focus:border-[var(--night-accent-45)]"
            placeholder={`Пиши на ${task.lang === 'es' ? 'испанском' : 'английском'}…`}
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
            autoCapitalize="sentences"
          />
          <div className="flex items-center justify-between text-xs text-[var(--night-text-40)]">
            <span className={tooShort ? 'text-amber-400' : ''}>
              {words} слов{minWords ? ` (минимум ${minWords})` : ''}
            </span>
            {grade && (
              <button className="text-[var(--night-text-40)]" onClick={() => setEditing(false)}>
                отмена
              </button>
            )}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button onClick={submit} disabled={busy || !essay.trim()} loading={busy}>
            {busy ? 'AI проверяет…' : grade ? 'Пересдать' : 'Сдать на проверку'}
          </Button>
          <p className="text-center text-xs text-[var(--night-text-40)]">
            AI оценит сразу. Можешь править и пересдавать, пока преподаватель не проверил.
          </p>
        </>
      ) : (
        <>
          <Card>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--night-text-40)]">Твой текст</p>
            <p className="whitespace-pre-wrap leading-relaxed text-[var(--night-text-70)]">{essay}</p>
          </Card>

          {reviewed && row.teacher_review ? (
            <Card>
              <p className="mb-2 text-sm font-semibold">Разбор преподавателя</p>
              {row.teacher_review.comment && (
                <p className="mb-3 rounded-lg bg-white/[0.05] px-3 py-2 text-sm text-[var(--night-text-70)]">
                  {row.teacher_review.comment}
                </p>
              )}
              <WritingGradeView grade={row.teacher_review} mode={task.mode} />
            </Card>
          ) : grade ? (
            <Card>
              <p className="mb-2 text-sm font-semibold">Оценка AI</p>
              <WritingGradeView grade={grade} mode={task.mode} />
            </Card>
          ) : null}

          {row.attempts && row.attempts.length > 0 && (
            <Card>
              <WritingHistory attempts={row.attempts} />
            </Card>
          )}

          {reviewed ? (
            <p className="text-center text-sm text-[var(--night-text-40)]">
              Работа проверена преподавателем.
            </p>
          ) : (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Править и пересдать
            </Button>
          )}
        </>
      )}
    </div>
  )
}
