// ============================================================================
// Прохождение перепроверки: показывается перевод (рус), ученица печатает
// слово на изучаемом языке. Неверные слова возвращаются в колоду (again).
// ============================================================================
import { useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { normalizeAnswer as normalize } from '../../lib/text'
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
  const ok = current ? normalize(value) === normalize(current.front) : false

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
        ok: normalize(value) === normalize(current.front),
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
      <Card className="flex flex-col gap-3 text-center">
        <p className="text-4xl">{okCount === total ? '🎉' : okCount >= total / 2 ? '👍' : '💪'}</p>
        <p className="text-lg font-bold">
          Перепроверка: {okCount} из {total}
        </p>
        {wrong.length > 0 && (
          <div className="text-left">
            <p className="text-sm font-semibold text-[var(--night-text-40)]">
              Эти слова вернулись в колоду на повторение:
            </p>
            {wrong.map((r) => (
              <p key={r.card_id} className="mt-1 text-sm">
                <span className="font-semibold text-red-500">{r.given || '—'}</span>
                {' → '}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {r.front}
                </span>
                {r.back && <span className="text-[var(--night-text-40)]"> ({r.back})</span>}
              </p>
            ))}
          </div>
        )}
        <p className="text-sm text-[var(--night-text-40)]">
          {saving
            ? 'Сохраняю результат…'
            : saveError ?? 'Результат отправлен преподавателю ✓'}
        </p>
        <Button onClick={onDone}>К колоде</Button>
      </Card>
    )
  }

  if (!current) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-[var(--night-text-40)]">
        <span>🔁 Перепроверка от преподавателя</span>
        <span>
          {index + 1} / {total}
        </span>
      </div>

      <Card className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-[var(--night-text-40)]">Как пишется это слово?</p>
        <p className="text-2xl font-bold text-[var(--night-text)]">
          {current.back ?? '(без перевода)'}
        </p>

        <input
          className={`mt-2 w-full max-w-xs rounded-xl border px-4 py-3 text-center text-lg outline-none dark:bg-slate-900 ${
            checked
              ? ok
                ? 'border-emerald-500'
                : 'border-red-500'
              : 'border-white/[0.10] focus:border-[var(--night-accent-45)] dark:border-white/[0.10]'
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
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">Верно! ✓</p>
            ) : (
              <p className="text-sm">
                <span className="text-red-500">Правильно: </span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {current.front}
                </span>
              </p>
            )}
            <button
              onClick={() => speak(current.front, { lang })}
              className="rounded-full bg-white/[0.06] px-3 py-1 text-lg dark:bg-white/[0.08]"
              aria-label="Озвучить"
            >
              🔊
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
