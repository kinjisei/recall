// Шаг 2: план от AI — проверка и правки (пересоставить план / генерировать).
import { useState } from 'react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { BackHeader } from '../../../components/BackButton'
import {
  generateMaterialContent,
  generateMaterialPlan,
  type MaterialContent,
  type MaterialRequest,
} from '../../../lib/materials'
import type { MaterialPlan } from '../../../types'
import { inputClass } from './shared'

export function PlanScreen({
  req,
  plan,
  onBack,
  onReplanned,
  onGenerated,
}: {
  req: MaterialRequest
  plan: MaterialPlan
  onBack: () => void
  onReplanned: (plan: MaterialPlan) => void
  onGenerated: (content: MaterialContent) => void
}) {
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState<'replan' | 'generate' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const replan = async () => {
    setBusy('replan')
    setError(null)
    try {
      onReplanned(await generateMaterialPlan(req, feedback.trim() || undefined))
      setFeedback('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  const generate = async () => {
    setBusy('generate')
    setError(null)
    try {
      onGenerated(await generateMaterialContent(req, plan, feedback.trim() || undefined))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <BackHeader onBack={onBack} title="План материала от AI" label="К форме" />

      <Card className="flex flex-col gap-3">
        <p className="whitespace-pre-wrap text-sm text-[var(--night-text-70)]">
          {plan.comments}
        </p>

        <div>
          <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">Целевые слова</p>
          <div className="flex flex-wrap gap-1.5">
            {plan.vocabulary.map((w, i) => (
              <span key={i} className="rounded-full bg-sky-100 px-2.5 py-0.5 text-sm text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                {w}
              </span>
            ))}
          </div>
        </div>

        {plan.grammar_focus && (
          <p className="text-sm">
            <span className="text-xs font-semibold text-[var(--night-text-40)]">Грамматика: </span>
            {plan.grammar_focus}
          </p>
        )}

        <div>
          <p className="mb-1 text-xs font-semibold text-[var(--night-text-40)]">Упражнения</p>
          {plan.exercise_plan.map((p, i) => (
            <p key={i} className="text-sm text-[var(--night-text-70)]">
              • {p.kind === 'comprehension' ? 'Понимание текста' : p.kind === 'grammar' ? 'Грамматика' : 'Словарь'}:{' '}
              {p.count} шт. — {p.note}
            </p>
          ))}
        </div>
      </Card>

      <textarea
        className={`${inputClass} min-h-[64px]`}
        placeholder="Правки к плану (необязательно): «замени слово X», «добавь вопросов»…"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        disabled={busy !== null}
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={replan} disabled={busy !== null}>
          {busy === 'replan' ? 'Пересоставляю…' : '↻ Пересоставить план'}
        </Button>
        <Button className="flex-1" onClick={generate} disabled={busy !== null}>
          {busy === 'generate' ? 'Генерирую…' : 'Генерировать ✓'}
        </Button>
      </div>
    </div>
  )
}
