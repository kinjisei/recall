// ============================================================================
// Проверка письма преподавателем (Заход 5c): текст ученика + AI-оценка → учитель
// оставляет/убирает правки AI, ставит итоговый балл и комментарий → «Завершить
// проверку» (teacher_review, статус reviewed). Или «Переназначить на доработку»
// (текущий цикл уходит в историю attempts, ученик правит поверх прошлого текста).
// ============================================================================
import { useState } from 'react'
import { useDraftForm } from '../../shared/lib/useDraft'
import { DraftRestored } from '../../shared/ui/DraftRestored'
import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { BackHeader } from '../../shared/ui/BackButton'
import { IconCheck, IconClose } from '../../shared/ui/icons'
import { finishWritingReview, reassignWriting } from '../../lib/writing'
import type { WritingGrade, WritingTask, WritingTaskAssignment } from '../../types'
import { WritingGradeView } from './WritingGradeView'
import { WritingHistory } from './WritingHistory'
import { ChartView } from '../../components/ChartView'

export function WritingReviewScreen({
  task,
  assignment,
  studentName,
  onBack,
  onDone,
}: {
  task: WritingTask
  assignment: WritingTaskAssignment
  studentName: string
  onBack: () => void
  onDone: () => void
}) {
  const ai = assignment.ai_review
  const reviewed = assignment.status === 'reviewed'
  const prev = assignment.teacher_review
  const aiErrors = ai?.errors ?? []
  // Проверка — черновик до сохранения (Ф1.14): какие правки AI учитель
  // оставляет (по умолчанию — все), оценка и комментарий ученику.
  const [form, field, draft] = useDraftForm(`writing-review:${assignment.id}`, {
    kept: aiErrors.map(() => true),
    band:
      (reviewed ? prev?.band ?? prev?.level : undefined)?.toString() ??
      (task.mode === 'ielts' ? ai?.band?.toString() ?? '' : ai?.level ?? ''),
    comment: prev?.comment ?? '',
  })
  const { kept, band, comment } = form
  const [setKept, setBand, setComment] = [field('kept'), field('band'), field('comment')]
  const [busy, setBusy] = useState<'finish' | 'reassign' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const buildReview = (): WritingGrade => ({
    ...(ai ?? {}),
    errors: aiErrors.filter((_, i) => kept[i]),
    comment: comment.trim() || undefined,
    ...(task.mode === 'ielts' ? { band: Number(band) || ai?.band } : { level: band || ai?.level }),
  })

  const finish = async () => {
    setBusy('finish')
    setError(null)
    try {
      await finishWritingReview(assignment.id, buildReview(), band)
      draft.forget()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить проверку')
      setBusy(null)
    }
  }

  const reassign = async () => {
    const note = prompt('Комментарий ученику «на что обратить внимание» (необязательно):') ?? ''
    setBusy('reassign')
    setError(null)
    try {
      // сначала фиксируем текущий вердикт, чтобы он ушёл в историю попытки
      await finishWritingReview(assignment.id, buildReview(), band).catch(() => {})
      await reassignWriting(assignment.id, note)
      draft.forget()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось переназначить')
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <BackHeader onBack={onBack} title={`Проверка · ${studentName}`} label="Назад" />

      <Card>
        <p className="text-xs text-fg-muted">
          {task.mode === 'ielts'
            ? `IELTS · ${task.settings?.ieltsTask === 'gt1' ? 'GT Task 1' : 'Task 2'}`
            : `Эссе · ${task.level}`}
        </p>
        <p className="mt-1 text-sm font-medium">{task.prompt}</p>
        {task.settings?.chart && (
          <div className="mt-3 rounded-xl border border-tint/[0.08] p-3">
            <ChartView chart={task.settings.chart} />
          </div>
        )}
      </Card>

      <Card>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-fg-muted">Текст ученика</p>
        <p className="whitespace-pre-wrap leading-relaxed text-fg-secondary">
          {assignment.essay || '(пусто)'}
        </p>
      </Card>

      {ai && (
        <Card>
          <p className="mb-2 text-sm font-semibold">Оценка AI (черновик)</p>
          <WritingGradeView grade={ai} mode={task.mode} />
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <p className="text-sm font-semibold">Твоя проверка</p>

        {aiErrors.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-fg-muted">
              Правки AI — оставить/убрать
            </p>
            <div className="flex flex-col gap-1.5">
              {aiErrors.map((e, i) => (
                <button
                  key={i}
                  onClick={() => setKept((k) => k.map((v, j) => (j === i ? !v : v)))}
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm ${
                    kept[i] ? 'border-success/40' : 'border-tint/[0.08] opacity-50'
                  }`}
                >
                  <span className={`mt-0.5 flex-none ${kept[i] ? 'text-success-strong' : 'text-fg-muted'}`}>
                    {kept[i] ? <IconCheck size={16} /> : <IconClose size={16} />}
                  </span>
                  <span>
                    <span className="text-danger-soft-fg line-through decoration-danger/50">{e.was}</span>
                    {' → '}
                    <span className="text-success-soft-fg">{e.fix}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-fg-muted">
            Итоговый {task.mode === 'ielts' ? 'band' : 'уровень'}
          </p>
          <input
            className="w-28 rounded-lg border border-tint/[0.10] bg-input px-3 py-2 outline-none focus:border-accent-line"
            value={band}
            onChange={(e) => setBand(e.target.value)}
            placeholder={task.mode === 'ielts' ? '6.5' : 'B1'}
          />
        </div>

        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-fg-muted">
            Комментарий ученику
          </p>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-tint/[0.10] bg-input px-3 py-2 outline-none focus:border-accent-line"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Что удалось, над чем поработать…"
          />
          {draft.restored && <DraftRestored onClear={draft.clear} className="mt-1" />}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          <Button className="flex-1" onClick={finish} loading={busy === 'finish'} disabled={busy !== null}>
            {reviewed ? 'Обновить проверку' : 'Завершить проверку'}
          </Button>
          <Button variant="secondary" onClick={reassign} loading={busy === 'reassign'} disabled={busy !== null}>
            На доработку
          </Button>
        </div>
      </Card>

      {assignment.attempts && assignment.attempts.length > 0 && (
        <Card>
          <WritingHistory attempts={assignment.attempts} />
        </Card>
      )}
    </div>
  )
}
