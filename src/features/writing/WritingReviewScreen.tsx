// ============================================================================
// Проверка письма преподавателем (Заход 5c): текст ученицы + AI-оценка → учитель
// оставляет/убирает правки AI, ставит итоговый балл и комментарий → «Завершить
// проверку» (teacher_review, статус reviewed). Или «Переназначить на доработку»
// (текущий цикл уходит в историю attempts, ученица правит поверх прошлого текста).
// ============================================================================
import { useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { BackHeader } from '../../components/BackButton'
import { IconCheck, IconClose } from '../../components/icons'
import { finishWritingReview, reassignWriting } from '../../lib/writing'
import type { WritingGrade, WritingTask, WritingTaskAssignment } from '../../types'
import { WritingGradeView } from './WritingGradeView'
import { WritingHistory } from './WritingHistory'

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
  // какие правки AI учитель оставляет (по умолчанию — все)
  const [kept, setKept] = useState<boolean[]>(aiErrors.map(() => true))
  const [band, setBand] = useState(
    (reviewed ? prev?.band ?? prev?.level : undefined)?.toString() ??
      (task.mode === 'ielts' ? ai?.band?.toString() ?? '' : ai?.level ?? ''),
  )
  const [comment, setComment] = useState(prev?.comment ?? '')
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
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить проверку')
      setBusy(null)
    }
  }

  const reassign = async () => {
    const note = prompt('Комментарий ученице «на что обратить внимание» (необязательно):') ?? ''
    setBusy('reassign')
    setError(null)
    try {
      // сначала фиксируем текущий вердикт, чтобы он ушёл в историю попытки
      await finishWritingReview(assignment.id, buildReview(), band).catch(() => {})
      await reassignWriting(assignment.id, note)
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
        <p className="text-xs text-[var(--night-text-40)]">
          {task.mode === 'ielts'
            ? `IELTS · ${task.settings?.ieltsTask === 'gt1' ? 'GT Task 1' : 'Task 2'}`
            : `Эссе · ${task.level}`}
        </p>
        <p className="mt-1 text-sm font-medium">{task.prompt}</p>
      </Card>

      <Card>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--night-text-40)]">Текст ученицы</p>
        <p className="whitespace-pre-wrap leading-relaxed text-[var(--night-text-70)]">
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
            <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--night-text-40)]">
              Правки AI — оставить/убрать
            </p>
            <div className="flex flex-col gap-1.5">
              {aiErrors.map((e, i) => (
                <button
                  key={i}
                  onClick={() => setKept((k) => k.map((v, j) => (j === i ? !v : v)))}
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm ${
                    kept[i] ? 'border-emerald-500/40' : 'border-white/[0.08] opacity-50'
                  }`}
                >
                  <span className={`mt-0.5 flex-none ${kept[i] ? 'text-emerald-400' : 'text-[var(--night-text-40)]'}`}>
                    {kept[i] ? <IconCheck size={16} /> : <IconClose size={16} />}
                  </span>
                  <span>
                    <span className="text-red-300 line-through decoration-red-500/50">{e.was}</span>
                    {' → '}
                    <span className="text-emerald-300">{e.fix}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--night-text-40)]">
            Итоговый {task.mode === 'ielts' ? 'band' : 'уровень'}
          </p>
          <input
            className="w-28 rounded-lg border border-white/[0.10] bg-[var(--night-input)] px-3 py-2 outline-none focus:border-[var(--night-accent-45)]"
            value={band}
            onChange={(e) => setBand(e.target.value)}
            placeholder={task.mode === 'ielts' ? '6.5' : 'B1'}
          />
        </div>

        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--night-text-40)]">
            Комментарий ученице
          </p>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-white/[0.10] bg-[var(--night-input)] px-3 py-2 outline-none focus:border-[var(--night-accent-45)]"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Что удалось, над чем поработать…"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

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
