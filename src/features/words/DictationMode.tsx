// ============================================================================
// «Диктант» — слово звучит, нужно напечатать его. Тренирует спеллинг:
// озвучка → ввод → проверка (общая нормализация из lib/text). Ошибка по слову
// из колоды возвращает карточку на повтор.
// ============================================================================
import { useEffect, useState } from 'react'
import { SpeakerHighIcon } from '@phosphor-icons/react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { RoundResult, RoundProgress } from '../../components/RoundResult'
import { logActivity } from '../../lib/activity'
import { speak } from '../../lib/speech'
import { answerMatches } from '../../lib/text'
import { loadGamePool, type PoolItem } from '../../lib/wordPool'
import { markWrong, pickWords } from './gameUtils'
import { EmptyPool, GameHeader, GameLoading } from './GameShell'
import type { AppLang } from '../../types'

const ROUND = 8
const TITLE = 'Диктант'

export function DictationMode({ lang, onBack }: { lang: AppLang; onBack: () => void }) {
  const [words, setWords] = useState<PoolItem[] | null>(null)
  const [empty, setEmpty] = useState(false)
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [value, setValue] = useState('')
  const [checked, setChecked] = useState<null | boolean>(null)

  const load = () => {
    loadGamePool(lang, ROUND * 3)
      .then((p) => {
        const picked = pickWords(p, ROUND).filter((w) => w.term)
        if (picked.length === 0) setEmpty(true)
        else setWords(picked)
      })
      .catch(() => setEmpty(true))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [lang])

  const current = words?.[index]
  const done = words !== null && index >= words.length

  // произносим слово при появлении
  useEffect(() => {
    if (current) speak(current.term, { lang })
  }, [current, lang])

  useEffect(() => {
    if (done) void logActivity('practice')
  }, [done])

  if (empty) return <EmptyPool title={TITLE} onBack={onBack} />
  if (!words) return <GameLoading title={TITLE} onBack={onBack} />

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <GameHeader title={TITLE} onBack={onBack} />
        <RoundResult
          correct={correct}
          total={words.length}
          note={
            correct < words.length
              ? 'Слова с ошибками вернутся в ближайшее повторение.'
              : undefined
          }
          onRestart={() => {
            setWords(null)
            setIndex(0)
            setCorrect(0)
            setValue('')
            setChecked(null)
            load()
          }}
        />
      </div>
    )
  }

  const check = () => {
    if (checked !== null || !value.trim() || !current) return
    const ok = answerMatches(value, current.term)
    setChecked(ok)
    if (ok) setCorrect((c) => c + 1)
    else markWrong(current)
  }

  const next = () => {
    setIndex((i) => i + 1)
    setValue('')
    setChecked(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <GameHeader title={TITLE} onBack={onBack} />
      <RoundProgress index={index + 1} total={words.length} correct={correct} />

      <Card className="flex flex-col gap-3">
        <button
          onClick={() => current && speak(current.term, { lang })}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--night-accent-900)] text-[var(--night-accent-100)]"
          aria-label="Прослушать ещё раз"
        >
          <SpeakerHighIcon size={32} weight="fill" />
        </button>
        <p className="text-center text-sm text-[var(--night-text-40)]">
          Напиши слово, которое услышишь{current?.translation ? ` · подсказка: «${current.translation}»` : ''}
        </p>

        <input
          aria-label="Услышанное слово"
          className={`w-full rounded-lg border bg-[var(--night-input)] px-3 py-2 outline-none ${
            checked === null
              ? 'border-white/[0.10] focus:border-[var(--night-accent-45)]'
              : checked
                ? 'border-emerald-500'
                : 'border-red-500'
          }`}
          placeholder="Слово…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && check()}
          disabled={checked !== null}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />

        {checked === false && current && (
          <p className="text-sm">
            <span className="text-red-500">Правильно: </span>
            <span className="font-semibold text-emerald-400">{current.term}</span>
          </p>
        )}
        {checked === true && (
          <p className="text-sm font-semibold text-emerald-400">Верно! ✓</p>
        )}

        {checked === null ? (
          <Button onClick={check} disabled={!value.trim()}>
            Проверить
          </Button>
        ) : (
          <Button onClick={next}>
            {index + 1 >= words.length ? 'Итоги' : 'Дальше →'}
          </Button>
        )}
      </Card>
    </div>
  )
}
