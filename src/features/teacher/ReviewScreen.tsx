// ============================================================================
// Проверка сданного задания по материалу (макет d7-2, PLAN.md Ф2.17-4в-1): AI
// делает первичный разбор, преподаватель по каждому упражнению соглашается
// или ставит свой вердикт с комментарием и завершает проверку (статус
// reviewed). Слева — текст материала свёрнутой строкой и упражнения, справа —
// итог «1 из 2», «Завершить проверку» и что откроется дальше; уже 936 —
// итог под упражнениями. Из «Проверки работ» сверху листалка «Работа 2 из 2».
// ============================================================================
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { whenDone } from '../../domains/schedule'
import { firstName } from '../../domains/students'
import { finishReview, generateAiReview, reassignAssignment, saveAiReview } from '../../lib/materials'
import { correctAnswerText } from '../../lib/text'
import type { Material, MaterialAssignment, ReviewItem } from '../../types'
import { ScreenTop } from '../../shared/ui/BackButton'
import { Button } from '../../shared/ui/Button'
import { Card } from '../../shared/ui/Card'
import { useConfirm } from '../../shared/ui/ConfirmDialog'
import { DraftRestored } from '../../shared/ui/DraftRestored'
import { MainAside } from '../../shared/ui/layouts'
import { Thinking } from '../../shared/ui/Thinking'
import { AiBanner, AnswerBox, ExerciseCard, MaterialText, ReviewSummary, Verdict } from './reviewBits'
import { useReviewDraft } from './useReviewDraft'

export function ReviewScreen({
  material,
  assignment,
  studentName,
  onDone,
  onBack,
  backLabel = 'Назад',
  pager,
  next,
}: {
  material: Material
  assignment: MaterialAssignment
  studentName: string
  onDone: () => void
  onBack: () => void
  /** Куда «назад»: «Задания» из хаба, «Материал» из библиотеки. */
  backLabel?: string
  /** Листалка «Работа 2 из 2 ‹ ›» — из «Проверки работ». */
  pager?: ReactNode
  /** Что откроется после «Завершить»: «Айгерим Нурланова · IELTS Task 2». */
  next?: string | null
}) {
  const alreadyReviewed = assignment.status === 'reviewed'
  const [base, setReview] = useState<ReviewItem[] | null>(alreadyReviewed ? assignment.teacher_review : assignment.ai_review)
  // правки учителя переживают перезагрузку до сохранения (Ф1.14)
  const { review, setItem, draft } = useReviewDraft(assignment.id, base)
  const [aiBusy, setAiBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { ask, dialog } = useConfirm()

  // Первичный AI-разбор (один раз). requestedRef защищает от двойного вызова
  // Gemini в StrictMode/dev; runAiReview можно вызвать повторно как ретрай.
  const requestedRef = useRef(false)
  const runAiReview = () => {
    if (aiBusy) return
    setAiBusy(true)
    setError(null)
    generateAiReview(material, assignment)
      .then((r) => {
        setReview(r)
        void saveAiReview(assignment.id, r) // кэшируем, чтобы не генерировать повторно
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка AI-разбора'))
      .finally(() => setAiBusy(false))
  }
  useEffect(() => {
    if (review !== null || requestedRef.current) return
    requestedRef.current = true
    runAiReview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const answers = assignment.answers ?? []
  const total = material.exercises.length
  const okCount = (review ?? []).filter((r) => r.ok).length
  const who = firstName(studentName)
  const title = material.title ?? material.topic

  const finish = async () => {
    if (!review) return
    setSaving(true)
    setError(null)
    try {
      await finishReview(assignment.id, review)
      draft.forget()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить проверку')
      setSaving(false)
    }
  }

  const reassign = async () => {
    const note = await ask({
      title: 'Переназначить материал?',
      body: `${who} сделает задание ещё раз; этот результат останется в истории.`,
      field: { label: 'На что обратить внимание', placeholder: 'Необязательно' },
      action: 'Переназначить',
      danger: false,
    })
    if (note === null) return
    setSaving(true)
    setError(null)
    try {
      await reassignAssignment(assignment, note)
      draft.forget()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось переназначить')
      setSaving(false)
    }
  }

  const attempts = assignment.attempts ?? []
  const main = (
    <div className="flex flex-col gap-3.5">
      <MaterialText title={title} body={material.body} lang={material.lang} />
      {draft.restored && <DraftRestored onClear={draft.clear} />}
      {aiBusy && (
        <p className="rounded-control bg-accent-soft px-4 py-3 text-body text-accent-soft-fg">
          <Thinking label="AI разбирает работу" className="text-accent-soft-fg" />
        </p>
      )}
      {error && (
        <Card tone="danger">
          <p className="text-sm text-danger-soft-fg">{error}</p>
          {!review && (
            <Button size="sm" variant="secondary" className="mt-2" onClick={runAiReview}>
              Повторить разбор
            </Button>
          )}
        </Card>
      )}
      {review && (
        <AiBanner>
          {alreadyReviewed ? `Проверено: ${okCount} из ${total}` : `AI предлагает засчитать ${okCount} из ${total} — проверь вердикты`}
        </AiBanner>
      )}
      {review &&
        material.exercises.map((ex, i) => {
          const item = review.find((r) => r.index === i)
          if (!item) return null
          const given = answers.find((a) => a.index === i)?.given ?? '(нет ответа)'
          return (
            <ExerciseCard key={i} n={i + 1} prompt={ex.prompt}>
              <AnswerBox who={who} given={given} correct={correctAnswerText(ex)} ok={item.ok} lang={material.lang} />
              {alreadyReviewed ? (
                item.comment && <p className="rounded-control-sm bg-input px-3 py-2.5 text-sm text-fg-secondary">{item.comment}</p>
              ) : (
                <>
                  <Verdict ok={item.ok} onChange={(ok) => setItem(i, { ok })} />
                  <label className="flex flex-col gap-1">
                    <small className="text-xs text-fg-muted">Комментарий · AI, можно править</small>
                    <textarea
                      className="field-sizing-content min-h-11 resize-none w-full rounded-control-sm bg-surface px-3 py-2.5 text-sm leading-relaxed text-fg inset-ring-1 inset-ring-line outline-none placeholder:text-fg-muted focus:inset-ring-2 focus:inset-ring-focus"
                      placeholder="Комментарий для ученика: что не так и как правильно…"
                      value={item.comment}
                      onChange={(e) => setItem(i, { comment: e.target.value })}
                    />
                  </label>
                </>
              )}
            </ExerciseCard>
          )
        })}
      {attempts.length > 0 && (
        <Card className="flex flex-col gap-1">
          <p className="text-sm font-semibold">Прошлые попытки</p>
          {attempts.map((at, i) => {
            const tOk = (at.teacher_review ?? []).filter((r) => r.ok).length
            return (
              <p key={i} className="text-sm text-fg-muted">
                {i + 1}-я: авто {at.auto_score}/{at.auto_total}
                {at.teacher_review ? ` · учитель ${tOk}/${at.auto_total}` : ''}
                {at.submitted_at ? ` · ${whenDone(at.submitted_at)}` : ''}
              </p>
            )
          })}
        </Card>
      )}
    </div>
  )
  const aside = review && (
    <ReviewSummary
      ok={okCount}
      total={total}
      next={alreadyReviewed ? null : next}
      action={
        alreadyReviewed ? (
          <Button variant="secondary" className="w-full" onClick={reassign} loading={saving}>
            Переназначить
          </Button>
        ) : (
          <Button className="w-full" onClick={finish} loading={saving}>
            Завершить проверку ({okCount}/{total})
          </Button>
        )
      }
    />
  )

  return (
    <div className="flex flex-col gap-4">
      <ScreenTop
        back={{ label: backLabel, onClick: onBack }}
        title={`${studentName} · «${title}»`}
        subtitle={['задание по материалу', whenDone(assignment.submitted_at)].filter(Boolean).join(' · ')}
        trailing={pager}
      />
      <MainAside narrow label="Итог проверки" main={main} aside={aside} />
      {dialog}
    </div>
  )
}
