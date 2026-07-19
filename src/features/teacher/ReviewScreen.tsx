// ============================================================================
// Проверка сданной работы преподавателем: AI делает первичный разбор,
// преподаватель по каждому упражнению соглашается или ставит свой вердикт
// с комментарием, затем завершает проверку (статус reviewed).
// ============================================================================
import { useEffect, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import {
  finishReview,
  generateAiReview,
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

  // Первичный AI-разбор, если его ещё нет
  useEffect(() => {
    if (review !== null || aiBusy) return
    setAiBusy(true)
    generateAiReview(material, assignment)
      .then((r) => {
        setReview(r)
        void saveAiReview(assignment.id, r) // кэшируем, чтобы не генерировать повторно
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка AI-разбора'))
      .finally(() => setAiBusy(false))
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
          ← Назад
        </Button>
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {alreadyReviewed ? 'Разбор работы' : 'Проверка работы'}: {studentName}
          </p>
          <p className="text-xs text-slate-400">
            {material.title ?? material.topic} · авто-результат {assignment.auto_score}/
            {assignment.auto_total}
          </p>
        </div>
      </div>

      <button
        onClick={() => setShowBody((s) => !s)}
        className="self-start text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
      >
        {showBody ? '▾ Скрыть текст материала' : '▸ Текст материала'}
      </button>
      {showBody && (
        <Card>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {material.body}
          </p>
        </Card>
      )}

      {aiBusy && (
        <Card>
          <p className="text-sm text-slate-500">🤖 AI разбирает работу…</p>
        </Card>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {review && (
        <>
          <p className="text-sm text-slate-500">
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
                <p className="text-xs text-slate-400">
                  {i + 1} · {kindLabel[ex.kind] ?? ex.kind}
                </p>
                <p className="text-sm font-medium">{ex.prompt}</p>
                <p className="text-sm">
                  Ответ ученицы:{' '}
                  <span className={item.ok ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'font-semibold text-red-500'}>
                    {given}
                  </span>
                  {!item.ok && correct && (
                    <span className="text-slate-400"> · правильно: {correct}</span>
                  )}
                </p>

                {alreadyReviewed ? (
                  item.comment && (
                    <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        ✓ Правильно
                      </button>
                      <button
                        onClick={() => setItem(i, { ok: false })}
                        className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                          !item.ok
                            ? 'bg-red-500 text-white'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        ✗ Ошибка
                      </button>
                    </div>
                    <textarea
                      className="min-h-[52px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900"
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
        </>
      )}
    </div>
  )
}
