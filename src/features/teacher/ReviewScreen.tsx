// ============================================================================
// Проверка сданной работы преподавателем: AI делает первичный разбор,
// преподаватель по каждому упражнению соглашается или ставит свой вердикт
// с комментарием, затем завершает проверку (статус reviewed).
// ============================================================================
import { useEffect, useRef, useState } from 'react'
import { BackButton } from '../../components/BackButton'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import {
  finishReview,
  generateAiReview,
  reassignAssignment,
  saveAiReview,
} from '../../lib/materials'
import type {
  Material,
  MaterialAssignment,
  ReviewItem,
} from '../../types'

const kindLabel = { comprehension: 'понимание', grammar: 'грамматика', vocab: 'словарь' } as const

export function ReviewScreen({
  material,
  assignment,
  studentName,
  onDone,
  onBack,
}: {
  material: Material
  assignment: MaterialAssignment
  studentName: string
  onDone: () => void
  onBack: () => void
}) {
  const alreadyReviewed = assignment.status === 'reviewed'
  const [review, setReview] = useState<ReviewItem[] | null>(
    alreadyReviewed ? assignment.teacher_review : assignment.ai_review,
  )
  const [aiBusy, setAiBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showBody, setShowBody] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [reassignNote, setReassignNote] = useState('')
  const [reassignBusy, setReassignBusy] = useState(false)

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
  const okCount = (review ?? []).filter((r) => r.ok).length

  const setItem = (index: number, patch: Partial<ReviewItem>) => {
    setReview((arr) =>
      (arr ?? []).map((r) => (r.index === index ? { ...r, ...patch } : r)),
    )
  }

  const finish = async () => {
    if (!review) return
    setSaving(true)
    setError(null)
    try {
      await finishReview(assignment.id, review)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить проверку')
      setSaving(false)
    }
  }

  const reassign = async () => {
    setReassignBusy(true)
    setError(null)
    try {
      await reassignAssignment(assignment, reassignNote)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось переназначить')
      setReassignBusy(false)
    }
  }

  const attempts = assignment.attempts ?? []

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {alreadyReviewed ? 'Разбор работы' : 'Проверка работы'}: {studentName}
          </p>
          <p className="text-xs text-[var(--night-text-40)]">
            {material.title ?? material.topic} · авто-результат {assignment.auto_score}/
            {assignment.auto_total}
          </p>
        </div>
      </div>

      <button
        onClick={() => setShowBody((s) => !s)}
        className="self-start text-sm font-medium text-[var(--night-accent-text)] hover:underline dark:text-[var(--night-accent-text)]"
      >
        {showBody ? '▾ Скрыть текст материала' : '▸ Текст материала'}
      </button>
      {showBody && (
        <Card>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--night-text-70)]">
            {material.body}
          </p>
        </Card>
      )}

      {attempts.length > 0 && (
        <Card>
          <p className="text-sm font-semibold">Прошлые попытки</p>
          {attempts.map((at, i) => {
            const tOk = (at.teacher_review ?? []).filter((r) => r.ok).length
            return (
              <p key={i} className="mt-1 text-sm text-[var(--night-text-40)]">
                {i + 1}-я: авто {at.auto_score}/{at.auto_total}
                {at.teacher_review ? ` · учитель ${tOk}/${at.auto_total}` : ''}
                {at.submitted_at
                  ? ` · ${new Date(at.submitted_at).toLocaleDateString('ru-RU')}`
                  : ''}
              </p>
            )
          })}
        </Card>
      )}

      {aiBusy && (
        <Card>
          <p className="text-sm text-[var(--night-text-40)]">🤖 AI разбирает работу…</p>
        </Card>
      )}
      {error && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/30">
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          {!review && (
            <Button variant="secondary" className="mt-2 px-3 py-1.5 text-sm" onClick={runAiReview}>
              Повторить разбор
            </Button>
          )}
        </Card>
      )}

      {review && (
        <>
          <p className="text-sm text-[var(--night-text-40)]">
            {alreadyReviewed
              ? `Итог проверки: ${okCount} из ${material.exercises.length}.`
              : `AI предлагает засчитать ${okCount} из ${material.exercises.length}. Проверь вердикты — каждый можно изменить.`}
          </p>

          {material.exercises.map((ex, i) => {
            const item = review.find((r) => r.index === i)
            const given = answers.find((a) => a.index === i)?.given ?? '(нет ответа)'
            const correct =
              ex.type === 'mcq' ? ex.options[ex.answer] : ex.type === 'fill' ? ex.answer : ''
            if (!item) return null
            return (
              <Card key={i} className="flex flex-col gap-2">
                <p className="text-xs text-[var(--night-text-40)]">
                  {i + 1} · {kindLabel[ex.kind] ?? ex.kind}
                </p>
                <p className="text-sm font-medium">{ex.prompt}</p>
                <p className="text-sm">
                  Ответ ученицы:{' '}
                  <span className={item.ok ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'font-semibold text-red-500'}>
                    {given}
                  </span>
                  {!item.ok && correct && (
                    <span className="text-[var(--night-text-40)]"> · правильно: {correct}</span>
                  )}
                </p>

                {alreadyReviewed ? (
                  item.comment && (
                    <p className="rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-[var(--night-text-70)] dark:bg-[var(--night-surface)] dark:text-[var(--night-text-25)]">
                      {item.comment}
                    </p>
                  )
                ) : (
                  <>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setItem(i, { ok: true })}
                        className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                          item.ok
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white/[0.07] text-[var(--night-text-70)] dark:bg-white/[0.08] dark:text-[var(--night-text-25)]'
                        }`}
                      >
                        ✓ Правильно
                      </button>
                      <button
                        onClick={() => setItem(i, { ok: false })}
                        className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                          !item.ok
                            ? 'bg-red-500 text-white'
                            : 'bg-white/[0.07] text-[var(--night-text-70)] dark:bg-white/[0.08] dark:text-[var(--night-text-25)]'
                        }`}
                      >
                        ✗ Ошибка
                      </button>
                    </div>
                    <textarea
                      className="min-h-[120px] w-full rounded-lg border border-white/[0.10] bg-[var(--night-input)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--night-accent-45)]"
                      placeholder="Комментарий для ученицы: что не так и как правильно…"
                      value={item.comment}
                      onChange={(e) => setItem(i, { comment: e.target.value })}
                    />
                  </>
                )}
              </Card>
            )
          })}

          {!alreadyReviewed && (
            <Button onClick={finish} disabled={saving}>
              {saving
                ? 'Сохраняю…'
                : `Завершить проверку (${okCount}/${material.exercises.length}) ✓`}
            </Button>
          )}

          {alreadyReviewed && (
            <Card className="flex flex-col gap-2">
              {!reassignOpen ? (
                <button
                  onClick={() => setReassignOpen(true)}
                  className="text-left text-sm font-medium text-[var(--night-accent-text)] hover:underline dark:text-[var(--night-accent-text)]"
                >
                  ↻ Переназначить этот материал (текущий результат сохранится в истории)
                </button>
              ) : (
                <>
                  <p className="text-sm font-semibold">Переназначить материал</p>
                  <textarea
                    className="min-h-[100px] w-full rounded-lg border border-white/[0.10] bg-[var(--night-input)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--night-accent-45)]"
                    placeholder="Комментарий для ученицы: на что обратить внимание в этот раз…"
                    value={reassignNote}
                    onChange={(e) => setReassignNote(e.target.value)}
                    disabled={reassignBusy}
                  />
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={reassign} disabled={reassignBusy}>
                      {reassignBusy ? 'Переназначаю…' : '↻ Переназначить'}
                    </Button>
                    <Button variant="ghost" onClick={() => setReassignOpen(false)} disabled={reassignBusy}>
                      Отмена
                    </Button>
                  </div>
                </>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
