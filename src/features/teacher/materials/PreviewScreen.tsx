// Шаг 3: предпросмотр материала (с ответами) — сохранить или перегенерировать.
import { useState } from 'react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { BackHeader } from '../../../components/BackButton'
import {
  generateMaterialContent,
  generateExercisesForText,
  saveMaterial,
  type MaterialContent,
  type MaterialRequest,
} from '../../../lib/materials'
import type { Material, MaterialPlan } from '../../../types'
import { inputClass } from './shared'

export function PreviewScreen({
  req,
  plan,
  content,
  own = false,
  onRegenerated,
  onSaved,
  onBack,
}: {
  req: MaterialRequest
  plan: MaterialPlan
  content: MaterialContent
  /** «Мой текст»: перегенерируем ТОЛЬКО упражнения, тело сохраняем. */
  own?: boolean
  onRegenerated: (content: MaterialContent) => void
  onSaved: (material: Material) => void
  onBack: () => void
}) {
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState<'regen' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const regen = async () => {
    setBusy('regen')
    setError(null)
    try {
      const fb = feedback.trim() || undefined
      const next = own
        ? await generateExercisesForText(content.body, req.lang, req.level, {
            vocabulary: req.vocabulary,
            grammar: req.grammar,
            feedback: fb,
          })
        : await generateMaterialContent(req, plan, fb)
      onRegenerated(next)
      setFeedback('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    setBusy('save')
    setError(null)
    try {
      onSaved(await saveMaterial(req, plan, content))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
      setBusy(null)
    }
  }

  const wordCount = content.body.split(/\s+/).filter(Boolean).length

  return (
    <div className="flex flex-col gap-3">
      <BackHeader onBack={onBack} title="Предпросмотр" label={own ? 'К форме' : 'К плану'} />

      <Card>
        <p className="text-lg font-bold">{content.title}</p>
        <p className="mt-1 text-xs text-[var(--night-text-40)]">
          {req.level} · {req.format} · ~{wordCount} слов
        </p>
        <p className="mt-3 whitespace-pre-wrap leading-relaxed text-[var(--night-text-70)]">
          {content.body}
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Упражнения ({content.exercises.length}) — с ответами</p>
        {content.exercises.map((e, i) => (
          <div key={i} className="rounded-lg bg-[var(--night-surface)] px-3 py-2 text-sm">
            <p className="text-xs text-[var(--night-text-40)]">
              {i + 1}. {e.kind === 'comprehension' ? 'понимание' : e.kind === 'grammar' ? 'грамматика' : 'словарь'}
            </p>
            <p className="mt-0.5">{e.prompt}</p>
            {e.type === 'mcq' && (
              <p className="mt-0.5 text-emerald-400">
                ✓ {e.options[e.answer]}
                <span className="text-[var(--night-text-40)]"> (из: {e.options.join(' · ')})</span>
              </p>
            )}
            {e.type === 'fill' && (
              <p className="mt-0.5 text-emerald-400">✓ {e.answer}</p>
            )}
          </div>
        ))}
      </Card>

      <textarea
        className={`${inputClass} min-h-[64px]`}
        placeholder="Правки (необязательно): «сделай текст проще», «поменяй вопрос 3»…"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        disabled={busy !== null}
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={regen} disabled={busy !== null}>
          {busy === 'regen' ? 'Генерирую…' : '↻ Перегенерировать'}
        </Button>
        <Button className="flex-1" onClick={save} disabled={busy !== null}>
          {busy === 'save' ? 'Сохраняю…' : '💾 Сохранить'}
        </Button>
      </div>
    </div>
  )
}
