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
/**
 * Варианты ответа: обманки берём СНАЧАЛА из той же темы пака (topic_id), потом
 * добираем любыми. Раньше подставлялись случайные слова — «he ___ his job» с
 * вариантами landlord/bake/headache или «day off = ломтик» решались без чтения,
 * по несовпадению смысла. Слова одной темы («Работа»: hire, salary…) правдоподобнее.
 */
function optionsFor(item: PoolItem, pool: PoolItem[], pick: (i: PoolItem) => string): {
  options: string[]
  answer: number
} {
  const right = pick(item)
  const cand = pool.filter((p) => pick(p) && pick(p) !== right)
  const sameTopic = shuffle(cand.filter((p) => item.topic != null && p.topic === item.topic))
  const rest = shuffle(cand.filter((p) => item.topic == null || p.topic !== item.topic))
  const others = [...sameTopic, ...rest].slice(0, OPTIONS - 1).map(pick)
  const options = shuffle([right, ...others])
  return { options, answer: options.indexOf(right) }
}

/**
 * Похожесть слов на слух — для аудирования. Если варианты начинаются с
 * разных букв («think» против «apple», «orange»), задание решается без
 * прослушивания: услышал «т» — ответ очевиден. Поэтому подбираем обманки,
 * похожие по началу, концу и длине.
 */
function soundScore(a: string, b: string): number {
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  let score = 0
  if (x[0] === y[0]) score += 4
  if (x.slice(0, 2) === y.slice(0, 2)) score += 3
  if (x.slice(-2) === y.slice(-2)) score += 2
  score -= Math.min(3, Math.abs(x.length - y.length))
  return score
}

/**
 * Варианты для аудирования: похожие на ответ, а не случайные.
 * Приоритет — слова на ту же букву: если слышно «t», а остальные варианты
 * начинаются с гласных, задание решается вообще без прослушивания.
 * Уровень дистракторов не важен — их не учат, они лишь мешают угадывать.
 */
function listeningOptions(
  item: PoolItem,
  pool: PoolItem[],
): { options: string[]; answer: number } {
  const right = item.term
  const first = right[0]?.toLowerCase()
  const candidates = pool.filter(
    (p) => p.term && p.term.toLowerCase() !== right.toLowerCase(),
  )

  const sameLetter = shuffle(candidates.filter((p) => p.term[0]?.toLowerCase() === first))
  const others: string[] = sameLetter.slice(0, OPTIONS - 1).map((p) => p.term)

  // не хватило слов на ту же букву — добираем самыми похожими по звучанию
  if (others.length < OPTIONS - 1) {
    const ranked = candidates
      .filter((p) => !others.includes(p.term))
      .map((p) => ({ term: p.term, score: soundScore(right, p.term) }))
      .sort((a, b) => b.score - a.score)
    for (const r of ranked) {
      others.push(r.term)
      if (others.length === OPTIONS - 1) break
    }
  }

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

  if (empty) return <EmptyPool title="Пропущенное слово" onBack={onBack} />
  if (!questions) return <GameLoading title="Пропущенное слово" onBack={onBack} />
  return (
    <QuizRunner
      title="Пропущенное слово"
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

  if (empty) return <EmptyPool title="Быстрый перевод" onBack={onBack} />
  if (!questions) return <GameLoading title="Быстрый перевод" onBack={onBack} />
  return (
    <QuizRunner
      title="Быстрый перевод"
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
      const { options, answer } = listeningOptions(item, pool.items)
      return { prompt: '', options, answer, item, say: item.term }
    })
  }, [])
  const { questions, empty, restart } = useRound(lang, build)

  if (empty) return <EmptyPool title="Аудирование" onBack={onBack} />
  if (!questions) return <GameLoading title="Аудирование" onBack={onBack} />
  return (
    <QuizRunner
      title="Аудирование"
      hint="Нажми на динамик ещё раз, если не расслышал"
      questions={questions}
      lang={lang}
      onBack={onBack}
      onRestart={restart}
    />
  )
}
