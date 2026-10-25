// «Собери фразу»: по русскому переводу собери фразу из слов (EN и ES).
// Материал — встроенные фразы «Речи» (60 английских / 135 испанских).
import { useEffect, useMemo, useState } from 'react'
import { IconSpeaker } from '../../shared/ui/icons'
import { Button } from '../../shared/ui/Button'
import { RoundResult } from '../../components/RoundResult'
import { orderHint, shouldReveal } from '../../lib/selfCorrect'
import type { ReviewItem } from '../../components/RoundReview'
import { logActivity } from '../../lib/activity'
import { getUserLevel } from '../../lib/level'
import { speak } from '../../lib/speech'
import { spanishSentences } from '../../data/spanish'
import { englishSentences } from '../../data/english'
import { RoundFrame } from '../../shared/ui/RoundFrame'
import { MistakeHint, RevealAnswer, RoundBuild, RoundFeedback, RoundFooter, RoundHint, RoundPrompt, RoundTask } from '../../shared/ui/roundParts'
import { normalize, sample } from './gameUtils'
import type { AppLang } from '../../types'

const ROUNDS = 8
const TITLE = 'Собери фразу'
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

interface Task {
  ru: string
  target: string
  words: string[]
}

/** Фразы не выше уровня ученика; если их мало — поднимаем планку на уровень. */
function byLevel<T extends { level: string }>(pool: T[], level: string | null): T[] {
  const t = level ? LEVELS.indexOf(level) : LEVELS.length - 1
  if (t < 0) return pool
  for (let up = 0; up <= LEVELS.length; up++) {
    const cands = pool.filter((s) => {
      const i = LEVELS.indexOf(s.level)
      return i < 0 || i <= t + up
    })
    if (cands.length >= ROUNDS) return cands
  }
  return pool
}

export function SentenceBuilder({ lang, onBack }: { lang: AppLang; onBack: () => void }) {
  const [seed, setSeed] = useState(0)
  const [level, setLevel] = useState<string | null>(null)

  useEffect(() => {
    getUserLevel(lang).then(setLevel).catch(() => setLevel(null))
  }, [lang])

  const tasks = useMemo<Task[]>(() => {
    // Берём короткие фразы (до 8 слов) — их приятнее собирать.
    const source =
      lang === 'es'
        ? spanishSentences.map((s) => ({ ru: s.ru, target: s.es, level: s.level }))
        : englishSentences.map((s) => ({ ru: s.ru, target: s.en, level: s.level }))
    const short = source.filter((s) => s.target.trim().split(/\s+/).length <= 8)
    const pool = byLevel(short, level)
    return sample(pool, ROUNDS).map((s) => ({
      ru: s.ru,
      target: s.target,
      words: s.target.trim().split(/\s+/),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, lang, level])

  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [results, setResults] = useState<ReviewItem[]>([])
  const [done, setDone] = useState(false)

  const task = tasks[index]
  // index держится в границах tasks (next() увеличивает его только пока
  // index+1 < tasks.length, иначе выставляет done) — guard для компилятора
  if (!task) return null

  const onResult = (ok: boolean, given: string) => {
    if (ok) setCorrect((c) => c + 1)
    setResults((r) => [...r, { prompt: task.ru, given, correct: task.target, ok }])
  }
  const next = () => {
    if (index + 1 >= tasks.length) {
      setDone(true)
      void logActivity('practice')
    } else {
      setIndex((i) => i + 1)
    }
  }

  if (done) {
    return (
      <RoundFrame title={TITLE} at={tasks.length} total={tasks.length} results={results.map((r) => r.ok)} onExit={onBack}>
        <RoundResult
          correct={correct}
          total={tasks.length}
          review={results}
          lang={lang}
          restartLabel="Ещё раз"
          onRestart={() => {
            setIndex(0)
            setCorrect(0)
            setResults([])
            setDone(false)
            setSeed((s) => s + 1)
          }}
        />
      </RoundFrame>
    )
  }

  return (
    <RoundFrame title={TITLE} at={index + 1} total={tasks.length} results={results.map((r) => r.ok)} onExit={onBack}>
      <BuildTask
        key={`${lang}-${index}`}
        task={task}
        lang={lang}
        onResult={onResult}
        onNext={next}
        isLast={index + 1 >= tasks.length}
      />
    </RoundFrame>
  )
}

function BuildTask({
  task,
  lang,
  onResult,
  onNext,
  isLast,
}: {
  task: Task
  lang: AppLang
  onResult: (ok: boolean, given: string) => void
  onNext: () => void
  isLast: boolean
}) {
  const shuffled = useMemo(
    () => task.words.map((w, i) => ({ w, i })).sort(() => Math.random() - 0.5),
    [task],
  )
  const [built, setBuilt] = useState<{ w: string; i: number }[]>([])
  // ⚠️ Самокоррекция — то же правило, что в общем движке упражнений: первая
  // ошибка даёт подсказку О МЕСТЕ, ответ появляется со второй попытки или по
  // кнопке. Балл (onResult) — по ПЕРВОЙ попытке, иначе счёт раунда перестаёт
  // что-либо значить.
  const [attempts, setAttempts] = useState(0)
  const [solved, setSolved] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const checked = solved || revealed

  const ok = normalize(built.map((b) => b.w).join(' ')) === normalize(task.target)

  const check = () => {
    if (checked || built.length !== task.words.length) return
    const n = attempts + 1
    setAttempts(n)
    if (attempts === 0) onResult(ok, built.map((b) => b.w).join(' '))
    if (ok) {
      setSolved(true)
      return
    }
    if (shouldReveal(n)) setRevealed(true)
    else setHint(orderHint(built.map((b) => b.w), task.target.split(/\s+/)))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <RoundTask>Переведи на {lang === 'es' ? 'испанский' : 'английский'}:</RoundTask>
        <RoundPrompt text={task.ru} />
      </div>

      <RoundBuild
        built={built}
        bank={shuffled}
        result={checked ? ok : null}
        onTake={(item) => setBuilt((arr) => [...arr, item])}
        onDrop={(i) => setBuilt((arr) => arr.filter((_, j) => j !== i))}
      />

      {!checked && hint && <MistakeHint text={hint} />}
      {!checked && attempts > 0 && <RevealAnswer onClick={() => setRevealed(true)} />}

      <RoundFooter>
        {checked ? (
          <div className="flex flex-1 items-center gap-2">
            {solved ? (
              <RoundFeedback ok title={attempts > 1 ? 'Верно — со второй попытки!' : 'Верно!'}>
                {task.target}
              </RoundFeedback>
            ) : (
              <RoundFeedback ok={false}>Правильно: {task.target}</RoundFeedback>
            )}
            <button
              type="button"
              onClick={() => speak(task.target, { lang })}
              className="flex size-11 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg"
              aria-label="Озвучить"
            >
              <IconSpeaker size={18} />
            </button>
          </div>
        ) : (
          <RoundHint>Собери фразу из слов и нажми «Проверить»</RoundHint>
        )}
        {checked ? (
          <Button className="flex-none @xl/round:px-5.5!" onClick={onNext}>
            {isLast ? 'Итоги' : 'Дальше'}
          </Button>
        ) : (
          <div className="flex flex-none gap-2">
            {built.length > 0 && (
              <Button variant="ghost" onClick={() => setBuilt([])}>
                Сброс
              </Button>
            )}
            <Button onClick={check} disabled={built.length !== task.words.length} className="flex-1 @xl/round:px-5.5!">
              Проверить
            </Button>
          </div>
        )}
      </RoundFooter>
    </div>
  )
}
