// «Собери фразу»: по русскому переводу собери фразу из слов (EN и ES).
// Материал — встроенные фразы «Речи» (60 английских / 135 испанских).
import { useEffect, useMemo, useState } from 'react'
import { IconSpeaker } from '../../components/icons'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { RoundResult, RoundProgress } from '../../components/RoundResult'
import { logActivity } from '../../lib/activity'
import { getUserLevel } from '../../lib/level'
import { speak } from '../../lib/speech'
import { spanishSentences } from '../../data/spanish'
import { englishSentences } from '../../data/english'
import { GameHeader as Header } from './GameShell'
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
  const [done, setDone] = useState(false)

  const task = tasks[index]

  const onResult = (ok: boolean) => {
    if (ok) setCorrect((c) => c + 1)
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
      <div className="flex flex-col gap-4">
        <Header title={TITLE} onBack={onBack} />
        <RoundResult
          correct={correct}
          total={tasks.length}
          restartLabel="Ещё раз"
          onRestart={() => {
            setIndex(0)
            setCorrect(0)
            setDone(false)
            setSeed((s) => s + 1)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Header title={TITLE} onBack={onBack} />
      <RoundProgress index={index + 1} total={tasks.length} correct={correct} />
      <BuildTask
        key={`${lang}-${index}`}
        task={task}
        lang={lang}
        onResult={onResult}
        onNext={next}
        isLast={index + 1 >= tasks.length}
      />
    </div>
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
  onResult: (ok: boolean) => void
  onNext: () => void
  isLast: boolean
}) {
  const shuffled = useMemo(
    () => task.words.map((w, i) => ({ w, i })).sort(() => Math.random() - 0.5),
    [task],
  )
  const [built, setBuilt] = useState<{ w: string; i: number }[]>([])
  const [checked, setChecked] = useState(false)

  const used = new Set(built.map((b) => b.i))
  const ok = normalize(built.map((b) => b.w).join(' ')) === normalize(task.target)

  const check = () => {
    if (checked || built.length !== task.words.length) return
    setChecked(true)
    onResult(ok)
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-[var(--night-text-40)]">
        Переведи на {lang === 'es' ? 'испанский' : 'английский'}:
      </p>
      <p className="text-lg font-medium">{task.ru}</p>

      <div
        className={`min-h-[48px] rounded-lg border-2 border-dashed p-2 ${
          checked ? (ok ? 'border-emerald-500' : 'border-red-500') : 'border-white/[0.10]'
        }`}
      >
        <div className="flex flex-wrap gap-2">
          {built.map((b, i) => (
            <button
              key={i}
              onClick={() => !checked && setBuilt((arr) => arr.filter((_, j) => j !== i))}
              disabled={checked}
              className="rounded-lg bg-[var(--night-accent)] px-3 py-1.5 text-sm text-white"
            >
              {b.w}
            </button>
          ))}
          {built.length === 0 && (
            <span className="px-1 py-1 text-sm text-[var(--night-text-40)]">нажимайте слова снизу по порядку</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {shuffled.map((item) => (
          <button
            key={item.i}
            onClick={() => !checked && setBuilt((arr) => [...arr, item])}
            disabled={checked || used.has(item.i)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              used.has(item.i)
                ? 'border-white/[0.08] text-[var(--night-text-25)]'
                : 'border-white/[0.10]'
            }`}
          >
            {item.w}
          </button>
        ))}
      </div>

      {checked && (
        <div className="flex items-center gap-2 text-sm">
          {ok ? (
            <span className="font-semibold text-emerald-400">Верно! ✓</span>
          ) : (
            <span>
              <span className="text-red-500">Правильно: </span>
              <span className="font-semibold text-emerald-400">{task.target}</span>
            </span>
          )}
          <button
            onClick={() => speak(task.target, { lang })}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.08] text-[var(--night-text-70)]"
            aria-label="Озвучить"
          >
            <IconSpeaker size={18} />
          </button>
        </div>
      )}

      {checked ? (
        <Button onClick={onNext}>{isLast ? 'Завершить' : 'Дальше →'}</Button>
      ) : (
        <div className="flex gap-2">
          <Button onClick={check} disabled={built.length !== task.words.length} className="flex-1">
            Проверить
          </Button>
          {built.length > 0 && (
            <Button variant="ghost" onClick={() => setBuilt([])}>
              Сброс
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}
