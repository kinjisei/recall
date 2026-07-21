// ============================================================================
// «Диктант» — слово звучит, нужно напечатать его. Тренирует спеллинг:
// озвучка → ввод → проверка (общая нормализация из lib/text). Ошибка по слову
// из колоды возвращает карточку на повтор.
//   • выбор источника: «Новые слова» (из паков) или «Мои слова» (из колоды);
//   • перевод-подсказка скрыт за кнопкой (не подсматриваешь заранее).
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { IconSpeaker } from '../../components/icons'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { RoundResult, RoundProgress } from '../../components/RoundResult'
import { logActivity } from '../../lib/activity'
import { speak } from '../../lib/speech'
import { answerMatches } from '../../lib/text'
import { loadGamePool, type PoolItem } from '../../lib/wordPool'
import { markWrong, sample } from './gameUtils'
import { GameHeader, GameLoading } from './GameShell'
import type { AppLang } from '../../types'

const ROUND = 8
const TITLE = 'Диктант'

type Source = 'new' | 'deck'

export function DictationMode({ lang, onBack }: { lang: AppLang; onBack: () => void }) {
  const [src, setSrc] = useState<Source>('new')
  const [words, setWords] = useState<PoolItem[] | null>(null)
  const [empty, setEmpty] = useState(false)
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [value, setValue] = useState('')
  const [checked, setChecked] = useState<null | boolean>(null)
  const [revealed, setRevealed] = useState(false)

  const load = useCallback(
    (source: Source) => {
      setWords(null)
      setEmpty(false)
      setIndex(0)
      setCorrect(0)
      setValue('')
      setChecked(null)
      setRevealed(false)
      loadGamePool(lang, ROUND * 4)
        .then((p) => {
          // «Мои» — только карточки колоды; «Новые» — только слова паков
          const list =
            source === 'deck' ? p.items.slice(0, p.fromDeck) : p.items.slice(p.fromDeck)
          const picked = sample(
            list.filter((w) => w.term),
            ROUND,
          )
          if (picked.length === 0) setEmpty(true)
          else setWords(picked)
        })
        .catch(() => setEmpty(true))
    },
    [lang],
  )

  useEffect(() => load(src), [src, load])

  const current = words?.[index]
  const done = words !== null && index >= words.length

  // произносим слово при появлении
  useEffect(() => {
    if (current) speak(current.term, { lang })
  }, [current, lang])

  useEffect(() => {
    if (done) void logActivity('practice')
  }, [done])

  if (!words && !empty) return <GameLoading title={TITLE} onBack={onBack} />

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <GameHeader title={TITLE} onBack={onBack} />
        <RoundResult
          correct={correct}
          total={words!.length}
          note={
            correct < words!.length
              ? 'Слова с ошибками вернутся в ближайшее повторение.'
              : undefined
          }
          onRestart={() => load(src)}
        />
      </div>
    )
  }

  const check = () => {
    if (checked !== null || !value.trim() || !current) return
    const ok = answerMatches(value, current.term)
    setChecked(ok)
    if (ok) setCorrect((c) => c + 1)
    else markWrong(current, lang)
  }

  const next = () => {
    setIndex((i) => i + 1)
    setValue('')
    setChecked(null)
    setRevealed(false)
  }

  const chip = (id: Source, label: string) => (
    <button
      key={id}
      onClick={() => setSrc(id)}
      className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
        src === id
          ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
          : 'bg-white/[0.06] text-[var(--night-text-40)]'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      <GameHeader title={TITLE} onBack={onBack} />

      {/* выбор источника слов */}
      <div className="flex gap-2">
        {chip('new', 'Новые слова')}
        {chip('deck', 'Мои слова')}
      </div>

      {empty ? (
        <Card className="text-center">
          <p className="font-medium">
            {src === 'deck' ? 'Пока нет своих слов' : 'Нет слов для диктанта'}
          </p>
          <p className="mt-1 text-sm text-[var(--night-text-40)]">
            {src === 'deck'
              ? 'Добавь слова в «Учёба» — или потренируйся на новых.'
              : 'Попробуй другой набор.'}
          </p>
        </Card>
      ) : (
        <>
          <RoundProgress index={index + 1} total={words!.length} correct={correct} />

          <Card className="flex flex-col gap-3">
            <button
              onClick={() => current && speak(current.term, { lang })}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--night-accent-900)] text-[var(--night-accent-100)]"
              aria-label="Прослушать ещё раз"
            >
              <IconSpeaker size={32} />
            </button>
            <p className="text-center text-sm text-[var(--night-text-40)]">
              Напиши слово, которое услышишь
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

            {/* подсказка-перевод — только по кнопке, чтобы не подсматривать */}
            {checked === null && current?.translation && (
              revealed ? (
                <p className="text-center text-sm text-[var(--night-text-40)]">
                  подсказка: «{current.translation}»
                </p>
              ) : (
                <button
                  onClick={() => setRevealed(true)}
                  className="mx-auto min-h-11 text-sm font-medium text-[var(--night-accent-text)]"
                >
                  Показать подсказку
                </button>
              )
            )}

            {checked === false && current && (
              <p className="text-sm">
                <span className="text-red-500">Правильно: </span>
                <span className="font-semibold text-emerald-400">{current.term}</span>
              </p>
            )}
            {checked === true && (
              <p className="text-sm font-semibold text-emerald-400">Верно!</p>
            )}

            {checked === null ? (
              <Button onClick={check} disabled={!value.trim()}>
                Проверить
              </Button>
            ) : (
              <Button onClick={next}>
                {index + 1 >= words!.length ? 'Итоги' : 'Дальше →'}
              </Button>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
