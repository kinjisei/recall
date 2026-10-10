// Шаг 2: план от AI — проверка и правки (пересоставить план / генерировать);
// целевые слова правятся руками, без новой генерации (Ф2.11б-3).
import { useState } from 'react'
import { Card } from '../../../shared/ui/Card'
import { Button } from '../../../shared/ui/Button'
import { BackHeader } from '../../../shared/ui/BackButton'
import {
  audienceOf,
  generateMaterialContent,
  generateMaterialPlan,
  type MaterialContent,
  type MaterialRequest,
} from '../../../lib/materials'
import type { StudentInfo } from '../../../lib/teacher'
import type { MaterialPlan } from '../../../types'
import { inputClass } from './shared'
import { namesLine } from './audience'
import { useDraft } from '../../../shared/lib/useDraft'
import { DraftRestored } from '../../../shared/ui/DraftRestored'

export function PlanScreen({
  req,
  plan,
  students,
  onBack,
  onForward,
  onReplanned,
  onGenerated,
}: {
  req: MaterialRequest
  plan: MaterialPlan
  /** Имена тех, для кого материал, — из списка учеников. */
  students: StudentInfo[]
  onBack: () => void
  /** Текст по плану уже готов (вернулись «назад» из предпросмотра) — к нему без новой генерации. */
  onForward?: () => void
  /** План пересоставлен или слова поправлены руками — тот же шаг. */
  onReplanned: (plan: MaterialPlan) => void
  onGenerated: (content: MaterialContent) => void
}) {
  // правки переживают перезагрузку; ушёл с экрана — стираются (Ф1.14)
  const [feedback, setFeedback, draft] = useDraft('material-plan-feedback', '')
  const back = () => {
    draft.forget()
    onBack()
  }
  const [busy, setBusy] = useState<'replan' | 'generate' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const forWhom = audienceOf(req).map((id) => students.find((s) => s.profile.id === id)?.profile.display_name || 'без имени')

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
      draft.forget()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <BackHeader onBack={back} title="План материала от AI" label="К форме" />

      <Card className="flex flex-col gap-3">
        <p className="text-xs text-fg-muted">
          {req.level} · {forWhom.length > 0 ? `для: ${namesLine(forWhom)}` : 'общий материал'}
        </p>
        <p className="whitespace-pre-wrap text-sm text-fg-secondary">
          {plan.comments}
        </p>

        <PlanWords
          words={plan.vocabulary}
          disabled={busy !== null}
          onChange={(vocabulary) => onReplanned({ ...plan, vocabulary })}
        />

        {plan.grammar_focus && (
          <p className="text-sm">
            <span className="text-xs font-semibold text-fg-muted">Грамматика: </span>
            {plan.grammar_focus}
          </p>
        )}

        <div>
          <p className="mb-1 text-xs font-semibold text-fg-muted">Упражнения</p>
          {plan.exercise_plan.map((p, i) => (
            <p key={i} className="text-sm text-fg-secondary">
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
      {draft.restored && <DraftRestored onClear={draft.clear} />}

      {error && <p className="text-sm text-danger">{error}</p>}

      {onForward && (
        <Button variant="secondary" onClick={onForward} disabled={busy !== null}>
          Вернуться к готовому тексту →
        </Button>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={replan} disabled={busy !== null}>
          {busy === 'replan' ? 'Пересоставляю…' : '↻ Пересоставить план'}
        </Button>
        <Button className="flex-1" onClick={generate} disabled={busy !== null}>
          {busy === 'generate' ? 'Генерирую…' : onForward ? 'Новый текст' : 'Генерировать ✓'}
        </Button>
      </div>
    </div>
  )
}

/** Слов в плане не больше: короткий текст столько не вместит. */
const WORDS_MAX = 12

/**
 * Целевые слова плана: убрать лишнее и дописать своё — без новой генерации
 * (Ф2.11б-3). Текст соберётся вокруг этого списка.
 */
function PlanWords({
  words,
  disabled,
  onChange,
}: {
  words: string[]
  disabled: boolean
  onChange: (words: string[]) => void
}) {
  const [typed, setTyped] = useState('')
  const add = () => {
    const fresh = typed
      .split(',')
      .map((w) => w.trim())
      .filter((w, i, all) => w && all.indexOf(w) === i && !words.some((x) => x.toLowerCase() === w.toLowerCase()))
    if (fresh.length) onChange([...words, ...fresh].slice(0, WORDS_MAX))
    setTyped('')
  }
  return (
    <div data-plan-words>
      <p className="mb-1 text-xs font-semibold text-fg-muted">Целевые слова</p>
      <div className="flex flex-wrap gap-1.5">
        {words.map((w, i) => (
          <span key={i} className="flex items-center rounded-full bg-accent-soft pl-2.5 text-sm text-accent-soft-fg">
            {w}
            <button
              aria-label={`Убрать «${w}»`}
              disabled={disabled}
              onClick={() => onChange(words.filter((_, j) => j !== i))}
              className="flex h-7 w-7 items-center justify-center rounded-full opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {words.length < WORDS_MAX && (
        <div className="mt-2 flex gap-2">
          <input
            className={inputClass}
            placeholder="Своё слово"
            aria-label="Своё слово в план"
            value={typed}
            disabled={disabled}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Button variant="secondary" className="shrink-0 px-3 py-1.5 text-sm" onClick={add} disabled={disabled || !typed.trim()}>
            Добавить
          </Button>
        </div>
      )}
    </div>
  )
}
