// ============================================================================
// Прохождение перепроверки: показывается перевод (рус), ученик печатает
// слово на изучаемом языке. Неверные слова возвращаются в колоду (again).
// ============================================================================
import { useState } from 'react'
import { IconSpeaker, IconRefresh } from '../../shared/ui/icons'
import { Card } from '../../shared/ui/Card'
import { ScoreGlyph } from '../../components/RoundResult'
import { Button } from '../../shared/ui/Button'
import { answerMatches } from '../../lib/text'
import { logActivity } from '../../lib/activity'
import { submitWordCheck } from '../../lib/wordChecks'
import { speak } from '../../lib/speech'
import type { AppLang, Card as CardType, WordCheck, WordCheckResult } from '../../types'

export function WordCheckRunner({
  check,
  cards,
  lang,
  onDone,
}: {
  check: WordCheck
  cards: CardType[]
  lang: AppLang
  onDone: () => void
}) {
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [checked, setChecked] = useState(false)
  const [results, setResults] = useState<WordCheckResult[]>([])
  const [finished, setFinished] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const total = cards.length
  const current = cards[index]
  // answerMatches (а не голое сравнение): принимает варианты через «/»
  // (was/were), как во всех остальных режимах — иначе верный ответ по карточке
  // со слэш-формой засчитывался бы как ошибка
  const ok = current ? answerMatches(value, current.front) : false

  const checkAnswer = () => {
    if (checked || !value.trim() || !current) return
    setChecked(true)
    setResults((r) => [
      ...r,
      {
        card_id: current.id,
        front: current.front,
        back: current.back,
        given: value.trim(),
        ok: answerMatches(value, current.front),
      },
    ])
  }

  const next = async () => {
    if (index + 1 >= total) {
      setFinished(true)
      setSaving(true)
      try {
        await submitWordCheck(check, results)
        void logActivity('flashcards')
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Не удалось сохранить результат')
      } finally {
        setSaving(false)
      }
    } else {
      setIndex((i) => i + 1)
      setValue('')
      setChecked(false)
    }
  }

  if (finished) {
    const okCount = results.filter((r) => r.ok).length
    const wrong = results.filter((r) => !r.ok)
    return (
      <Card className="flex flex-col items-center gap-3 text-center">
        <ScoreGlyph percent={total ? Math.round((okCount / total) * 100) : 0} />
        <p className="text-lg font-bold">
          Перепроверка: {okCount} из {total}
        </p>
        {wrong.length > 0 && (
          <div className="text-left">
            <p className="text-sm font-semibold text-fg-muted">
              Эти слова вернулись в колоду на повторение:
            </p>
            {wrong.map((r) => (
              <p key={r.card_id} className="mt-1 text-sm">
                <span className="font-semibold text-danger">{r.given || '—'}</span>
                {' → '}
                <span className="font-semibold text-success-strong">
                  {r.front}
                </span>
                {r.back && <span className="text-fg-muted"> ({r.back})</span>}
              </p>
            ))}
          </div>
        )}
        <p className="text-sm text-fg-muted">
          {saving
            ? 'Сохраняю результат…'
            : saveError ?? 'Результат отправлен преподавателю ✓'}
        </p>
        <Button onClick={onDone}>К повторению</Button>
      </Card>
    )
  }

  if (!current) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-fg-muted">
        <span className="flex items-center gap-1.5">
          <IconRefresh size={14} /> Перепроверка от преподавателя
        </span>
        <span>
          {index + 1} / {total}
        </span>
      </div>

      <Card className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-fg-muted">Как пишется это слово?</p>
        <p className="text-2xl font-bold text-fg">
          {current.back ?? '(без перевода)'}
        </p>

        <input
          className={`mt-2 w-full max-w-xs rounded-xl border bg-input px-4 py-3 text-center text-lg outline-none ${
            checked
              ? ok
                ? 'border-success'
                : 'border-danger'
              : 'border-tint/[0.10] focus:border-accent-line'
          }`}
          placeholder={lang === 'es' ? 'слово по-испански…' : 'слово по-английски…'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (checked ? next() : checkAnswer())}
          disabled={checked}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />

        {checked && (
          <div className="flex flex-col items-center gap-1">
            {ok ? (
              <p className="animate-answer-pop font-semibold text-success-strong">Верно! ✓</p>
            ) : (
              <p className="text-sm">
                <span className="text-danger">Правильно: </span>
                <span className="text-lg font-bold text-success-strong">
                  {current.front}
                </span>
              </p>
            )}
            <button
              onClick={() => speak(current.front, { lang })}
              className="rounded-full bg-tint/[0.08] px-3 py-2"
              aria-label="Озвучить"
            >
              <IconSpeaker size={18} />
            </button>
          </div>
        )}
      </Card>

      {checked ? (
        <Button onClick={next}>{index + 1 >= total ? 'Завершить' : 'Дальше →'}</Button>
      ) : (
        <Button onClick={checkAnswer} disabled={!value.trim()}>
          Проверить
        </Button>
      )}
    </div>
  )
}
