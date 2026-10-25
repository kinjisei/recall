// ============================================================================
// «Диктант» — слово звучит, нужно напечатать его. Тренирует спеллинг:
// озвучка → ввод → проверка (общая нормализация из lib/text). Ошибка по слову
// из колоды возвращает карточку на повтор.
//   • выбор источника: «Новые слова» (из паков) или «Мои слова» (из колоды);
//   • перевод-подсказка скрыт за кнопкой (не подсматриваешь заранее).
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { RoundResult } from '../../components/RoundResult'
import type { ReviewItem } from '../../components/RoundReview'
import { logActivity } from '../../lib/activity'
import { speak } from '../../lib/speech'
import { answerMatches } from '../../lib/text'
import { mistakeHint, shouldReveal } from '../../lib/selfCorrect'
import {
  loadGamePool,
  recordShown,
  withoutRecent,
  isTypable,
  type PoolItem,
} from '../../lib/wordPool'
import { markWrong, sample } from './gameUtils'
import { GameLoading } from './GameShell'
import { KEY_EXIT, RoundFrame, type RoundKey } from '../../shared/ui/RoundFrame'
import { MistakeHint, RevealAnswer, RoundFeedback, RoundFooter, RoundHint, RoundListen, RoundTask } from '../../shared/ui/roundParts'
import type { AppLang } from '../../types'

const ROUND = 8
const TITLE = 'Диктант'
// клавиши раунда сбоку (d5): Enter в поле — «Проверить», дальше — кнопкой
const KEYS: RoundKey[] = [{ keys: ['Enter'], label: 'проверить' }, KEY_EXIT]

type Source = 'new' | 'deck'

export function DictationMode({ lang, onBack }: { lang: AppLang; onBack: () => void }) {
  const [src, setSrc] = useState<Source>('new')
  const [words, setWords] = useState<PoolItem[] | null>(null)
  const [empty, setEmpty] = useState(false)
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [results, setResults] = useState<ReviewItem[]>([])
  const [value, setValue] = useState('')
  const [checked, setChecked] = useState<null | boolean>(null)
  const [attempts, setAttempts] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  const load = useCallback(
    (source: Source) => {
      setWords(null)
      setEmpty(false)
      setIndex(0)
      setCorrect(0)
      setResults([])
      setValue('')
      setChecked(null)
      setRevealed(false)
      loadGamePool(lang, ROUND * 4)
        .then((p) => {
          // «Мои» — только карточки колоды; «Новые» — только слова паков
          const list =
            source === 'deck' ? p.items.slice(0, p.fromDeck) : p.items.slice(p.fromDeck)
          // анти-повтор — как в pickWords: недавние пропускаем, пока хватает
          // Диктант — единственная игра, где ответ печатают руками, поэтому
          // фильтр жёстче общего: длинные идиомы годятся для выбора варианта,
          // но не для набора по памяти (см. isTypable в lib/wordPool).
          const picked = sample(
            withoutRecent(lang, list.filter((w) => w.term && isTypable(w.term)), ROUND),
            ROUND,
          )
          if (picked.length === 0) setEmpty(true)
          else {
            recordShown(lang, picked.map((w) => w.term))
            setWords(picked)
          }
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
      <RoundFrame title={TITLE} at={words!.length} total={words!.length} results={results.map((r) => r.ok)} keys={KEYS} onExit={onBack}>
        <RoundResult
          correct={correct}
          total={words!.length}
          review={results}
          lang={lang}
          note={
            correct < words!.length
              ? 'Слова с ошибками вернутся в ближайшее повторение.'
              : undefined
          }
          onRestart={() => load(src)}
        />
      </RoundFrame>
    )
  }

  // ⚠️ Самокоррекция — то же правило, что в общем движке упражнений: первая
  // ошибка показывает, ГДЕ она, ответ появляется со второй попытки или по
  // кнопке. Результат раунда пишется по ПЕРВОЙ попытке (иначе «8 из 10»
  // перестаёт значить «знает восемь»).
  const check = () => {
    if (checked !== null || !value.trim() || !current) return
    const ok = answerMatches(value, current.term)
    const n = attempts + 1
    setAttempts(n)
    if (attempts === 0) {
      setResults((r) => [
        ...r,
        {
          prompt: current.translation ? `На слух: «${current.translation}»` : 'Слово на слух',
          given: value.trim(),
          correct: current.term,
          ok,
        },
      ])
      if (ok) setCorrect((c) => c + 1)
      else markWrong(current, lang)
    }
    if (ok) {
      setChecked(true)
      return
    }
    if (shouldReveal(n)) setChecked(false)
    else setHint(mistakeHint(value, current.term))
  }

  const next = () => {
    setIndex((i) => i + 1)
    setValue('')
    setChecked(null)
    setRevealed(false)
    setAttempts(0)
    setHint(null)
  }

  const chip = (id: Source, label: string) => (
    <button
      key={id}
      onClick={() => setSrc(id)}
      className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
        src === id
          ? 'bg-accent-soft text-accent-soft-fg'
          : 'bg-tint/[0.06] text-fg-muted'
      }`}
    >
      {label}
    </button>
  )

  return (
    <RoundFrame
      title={TITLE}
      at={empty ? null : index + 1}
      total={empty ? null : words!.length}
      results={results.map((r) => r.ok)}
      keys={KEYS}
      onExit={onBack}
    >
      {/* выбор источника слов */}
      <div className="flex gap-2">
        {chip('new', 'Новые слова')}
        {chip('deck', 'Мои слова')}
      </div>

      {empty ? (
        <Card className="text-center">
          <p className="font-medium">{src === 'deck' ? 'Пока нет своих слов' : 'Нет слов для диктанта'}</p>
          <p className="mt-1 text-sm text-fg-muted">
            {src === 'deck' ? 'Добавь слова в «Учёба» — или потренируйся на новых.' : 'Попробуй другой набор.'}
          </p>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <RoundTask>Напиши слово, которое услышишь</RoundTask>
            <RoundListen onSay={() => current && speak(current.term, { lang })} />
          </div>

          {/* поле — как вариант d5: поверхность и черта, итог — зелёным или красным */}
          <input
            aria-label="Услышанное слово"
            className={`mt-2 min-h-14 w-full rounded-control px-4 text-lg text-fg outline-none placeholder:text-fg-muted @xl/round:min-h-15 ${
              checked === null
                ? 'bg-surface shadow-card inset-ring inset-ring-line focus:inset-ring-2 focus:inset-ring-focus'
                : checked
                  ? 'bg-success-soft inset-ring-2 inset-ring-success'
                  : 'bg-danger-soft inset-ring-2 inset-ring-danger'
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

          {checked === null && hint && <MistakeHint text={hint} />}
          {/* подсказка-перевод — только по кнопке, чтобы не подсматривать; ответ — после попытки */}
          {checked === null && (current?.translation || attempts > 0) && (
            <div className="flex flex-wrap gap-x-4">
              {current?.translation &&
                (revealed ? (
                  <p className="flex min-h-11 items-center text-sm text-fg-muted">подсказка: «{current.translation}»</p>
                ) : (
                  <button type="button" onClick={() => setRevealed(true)} className="min-h-11 text-sm font-medium text-accent-strong">
                    Показать подсказку
                  </button>
                ))}
              {attempts > 0 && <RevealAnswer onClick={() => setChecked(false)} />}
            </div>
          )}

          <RoundFooter>
            {checked === null ? (
              <RoundHint>Впиши слово и нажми Enter или «Проверить»</RoundHint>
            ) : checked ? (
              <RoundFeedback ok title={attempts > 1 ? 'Верно — со второй попытки!' : 'Верно!'}>
                {current?.translation ? `${current.term} — ${current.translation}` : undefined}
              </RoundFeedback>
            ) : (
              <RoundFeedback ok={false}>
                Правильно: {current?.term}
                {current?.translation ? ` — ${current.translation}` : ''}
              </RoundFeedback>
            )}
            {checked === null ? (
              <Button className="flex-none @xl/round:px-5.5!" onClick={check} disabled={!value.trim()}>
                Проверить
              </Button>
            ) : (
              <Button className="flex-none @xl/round:px-5.5!" onClick={next}>
                {index + 1 >= words!.length ? 'Итоги' : 'Дальше'}
              </Button>
            )}
          </RoundFooter>
        </>
      )}
    </RoundFrame>
  )
}
