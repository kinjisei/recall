// Шаг 3: предпросмотр материала (с ответами) — сохранить или перегенерировать.
// «Сохранить» сразу назначает тем, для кого материал (Ф2.11б-3).
import { useState } from 'react'
import { Card } from '../../../shared/ui/Card'
import { Button } from '../../../shared/ui/Button'
import { BackHeader } from '../../../shared/ui/BackButton'
import {
  assignMaterial,
  audienceOf,
  generateMaterialContent,
  generateExercisesForText,
  saveMaterial,
  type MaterialContent,
  type MaterialRequest,
} from '../../../lib/materials'
import type { StudentInfo } from '../../../lib/teacher'
import type { Material, MaterialPlan } from '../../../types'
import { inputClass } from './shared'
import { namesLine } from './audience'
import { useDraft } from '../../../shared/lib/useDraft'
import { DraftRestored } from '../../../shared/ui/DraftRestored'
import { correctAnswerText } from '../../../lib/text'

export function PreviewScreen({
  req,
  plan,
  content,
  own = false,
  students,
  onRegenerated,
  onSaved,
  onBack,
}: {
  req: MaterialRequest
  plan: MaterialPlan
  content: MaterialContent
  /** «Мой текст»: перегенерируем ТОЛЬКО упражнения, тело сохраняем. */
  own?: boolean
  /** Имена тех, для кого материал, — из списка учеников. */
  students: StudentInfo[]
  onRegenerated: (content: MaterialContent) => void
  /** notice — кому назначить не вышло (материал при этом сохранён). */
  onSaved: (material: Material, notice?: string) => void
  onBack: () => void
}) {
  const ids = audienceOf(req)
  const nameOf = (id: string) => students.find((s) => s.profile.id === id)?.profile.display_name || 'без имени'
  // правки переживают перезагрузку; ушёл с экрана — стираются (Ф1.14)
  const [feedback, setFeedback, draft] = useDraft('material-preview-feedback', '')
  const back = () => {
    draft.forget()
    onBack()
  }
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
    let material: Material
    try {
      material = await saveMaterial(req, plan, content)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
      setBusy(null)
      return
    }
    // «Для кого» — это же назначение: тем же RPC, что кнопка «Назначить» (права
    // и связь с учеником проверяет база). Не вышло у кого-то — материал всё
    // равно сохранён, назначить можно в его карточке; второй экземпляр не нужен.
    const settled = await Promise.allSettled(ids.map((id) => assignMaterial(material.id, id)))
    const failed = ids.filter((_, i) => settled[i]?.status === 'rejected').map(nameOf)
    draft.forget()
    onSaved(material, failed.length ? `Не назначено: ${failed.join(', ')} — назначь ниже ещё раз.` : undefined)
  }

  const wordCount = content.body.split(/\s+/).filter(Boolean).length

  return (
    <div className="flex flex-col gap-3">
      <BackHeader onBack={back} title="Предпросмотр" label={own ? 'К форме' : 'К плану'} />

      <Card>
        <p className="text-lg font-bold">{content.title}</p>
        <p className="mt-1 text-xs text-fg-muted">
          {req.level} · {req.format} · ~{wordCount} слов
        </p>
        <p className="mt-3 whitespace-pre-wrap leading-relaxed text-fg-secondary">
          {content.body}
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Упражнения ({content.exercises.length}) — с ответами</p>
        {content.exercises.map((e, i) => (
          <div key={i} className="rounded-lg bg-surface px-3 py-2 text-sm">
            <p className="text-xs text-fg-muted">
              {i + 1}. {e.kind === 'comprehension' ? 'понимание' : e.kind === 'grammar' ? 'грамматика' : 'словарь'}
            </p>
            <p className="mt-0.5">{e.prompt}</p>
            {e.type === 'mcq' && (
              <p className="mt-0.5 text-success-strong">
                ✓ {e.options[e.answer]}
                <span className="text-fg-muted"> (из: {e.options.join(' · ')})</span>
              </p>
            )}
            {e.type === 'fill' && (
              <p className="mt-0.5 text-success-strong">✓ {e.answer}</p>
            )}
            {e.type === 'order' && (
              <p className="mt-0.5 text-success-strong">
                ✓ {correctAnswerText(e)}
                <span className="text-fg-muted"> (слова: {e.words.join(' · ')})</span>
              </p>
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
      {draft.restored && <DraftRestored onClear={draft.clear} />}

      {error && <p className="text-sm text-danger">{error}</p>}

      {ids.length > 0 && (
        <p className="text-xs text-fg-muted">Назначится при сохранении: {namesLine(ids.map(nameOf))}</p>
      )}
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
