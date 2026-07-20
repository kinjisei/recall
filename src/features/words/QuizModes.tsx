// ============================================================================
// Три режима на общем движке QuizRunner:
//   GapMode       — «Пропущенное слово»: предложение-пример с ___ и 4 варианта;
//   TranslateMode — «Быстрый перевод»: слово и 4 перевода;
//   ListeningMode — «Аудирование»: слово звучит, нужно выбрать написание.
// Слова берутся из общего пула (карточки пользователя + добор из паков).
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { loadGamePool, type GamePool, type PoolItem } from '../../lib/wordPool'
import { pickWords, shuffle } from './gameUtils'
import { EmptyPool, GameLoading, QuizRunner, type Question } from './GameShell'
import type { AppLang } from '../../types'

const ROUND = 8
const OPTIONS = 4

/** Прячет слово в предложении, оставляя пропуск. */
function blankOut(sentence: string, word: string): string | null {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*\\b`, 'i')
  if (!re.test(sentence)) return null
  return sentence.replace(re, '______')
}

/**
 * Каркас режима: грузит пул, строит вопросы и отдаёт их QuizRunner.
 * build — как из пула сделать вопросы (у каждого режима своя логика).
 */
function useRound(
  lang: AppLang,
  build: (pool: GamePool) => Question[],
): {
  questions: Question[] | null
  empty: boolean
  restart: () => void
} {
  const [pool, setPool] = useState<GamePool | null>(null)
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    let alive = true
    loadGamePool(lang, ROUND * 3)
      .then((p) => {
        if (!alive) return
        setPool(p)
        const qs = build(p)
        if (qs.length === 0) setEmpty(true)
        else setQuestions(qs)
      })
      .catch(() => alive && setEmpty(true))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  const restart = useCallback(() => {
    if (pool) setQuestions(build(pool))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool])

  return { questions, empty, restart }
}

/** Варианты-обманки того же языка. */
function optionsFor(item: PoolItem, pool: PoolItem[], pick: (i: PoolItem) => string): {
  options: string[]
  answer: number
} {
  const right = pick(item)
  const others = shuffle(pool.filter((p) => pick(p) !== right && pick(p)))
    .slice(0, OPTIONS - 1)
    .map(pick)
  const options = shuffle([right, ...others])
  return { options, answer: options.indexOf(right) }
}

// --- Пропущенное слово -----------------------------------------------------

export function GapMode({ lang, onBack }: { lang: AppLang; onBack: () => void }) {
  const build = useCallback((pool: GamePool): Question[] => {
    // играем только словами, у которых есть пример с этим словом внутри
    const usable: GamePool = {
      items: pool.items.filter((p) => p.example && blankOut(p.example, p.term)),
      fromDeck: pool.items
        .slice(0, pool.fromDeck)
        .filter((p) => p.example && blankOut(p.example, p.term)).length,
    }
    const picked = pickWords(usable, ROUND)
    return picked.map((item) => {
      const { options, answer } = optionsFor(item, pool.items, (p) => p.term)
      return {
        prompt: blankOut(item.example!, item.term)!,
        options,
        answer,
        item,
      }
    })
  }, [])
  const { questions, empty, restart } = useRound(lang, build)

  if (empty) return <EmptyPool title="✏️ Пропущенное слово" onBack={onBack} />
  if (!questions) return <GameLoading title="✏️ Пропущенное слово" onBack={onBack} />
  return (
    <QuizRunner
      title="✏️ Пропущенное слово"
      hint="Какое слово подходит по смыслу?"
      questions={questions}
      lang={lang}
      onBack={onBack}
      onRestart={restart}
    />
  )
}

// --- Быстрый перевод -------------------------------------------------------

export function TranslateMode({ lang, onBack }: { lang: AppLang; onBack: () => void }) {
  const build = useCallback((pool: GamePool): Question[] => {
    const picked = pickWords(pool, ROUND)
    return picked.map((item) => {
      const { options, answer } = optionsFor(item, pool.items, (p) => p.translation)
      return { prompt: item.term, options, answer, item }
    })
  }, [])
  const { questions, empty, restart } = useRound(lang, build)

  if (empty) return <EmptyPool title="⚡ Быстрый перевод" onBack={onBack} />
  if (!questions) return <GameLoading title="⚡ Быстрый перевод" onBack={onBack} />
  return (
    <QuizRunner
      title="⚡ Быстрый перевод"
      hint="Выбери перевод слова"
      questions={questions}
      lang={lang}
      onBack={onBack}
      onRestart={restart}
    />
  )
}

// --- Аудирование -----------------------------------------------------------

export function ListeningMode({ lang, onBack }: { lang: AppLang; onBack: () => void }) {
  const build = useCallback((pool: GamePool): Question[] => {
    const picked = pickWords(pool, ROUND)
    return picked.map((item) => {
      const { options, answer } = optionsFor(item, pool.items, (p) => p.term)
      return { prompt: '', options, answer, item, say: item.term }
    })
  }, [])
  const { questions, empty, restart } = useRound(lang, build)

  if (empty) return <EmptyPool title="🎧 Аудирование" onBack={onBack} />
  if (!questions) return <GameLoading title="🎧 Аудирование" onBack={onBack} />
  return (
    <QuizRunner
      title="🎧 Аудирование"
      hint="Нажми 🔊 ещё раз, если не расслышал"
      questions={questions}
      lang={lang}
      onBack={onBack}
      onRestart={restart}
    />
  )
}
