// ============================================================================
// Placement-тест: определяет уровень изучаемого языка по вопросам от простого
// к сложному. Работает для обоих языков: испанский (A1–B2, пул 60) и
// английский (A1–C1, пул 60). Тест идёт блоками по 10 вопросов на уровень;
// если блок провален «с треском» (<40% верных), тест завершается раньше —
// новичка не мучаем полусотней вопросов C1.
// Результат: испанский — в localStorage (lib/esLevel, подстраивает «Диалог»),
// английский — в profiles.level (как в онбординге).
// Правильность по ходу НЕ показываем — это оценка, а не упражнение.
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { IconBack, IconSparkle } from '../../components/icons'
import { shuffle } from '../../lib/random'
import { setEsLevel } from '../../lib/esLevel'
import { reportPlacementResult } from '../../lib/placement'
import { supabase } from '../../lib/supabase'
import { invalidateProfile } from '../../lib/profile'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import type { AppLang, CEFRLevel, PlacementQuestion } from '../../types'

const LEVELS_BY_LANG: Record<AppLang, CEFRLevel[]> = {
  es: ['A1', 'A2', 'B1', 'B2'],
  en: ['A1', 'A2', 'B1', 'B2', 'C1'],
}
const PER_LEVEL = 10
const PASS = 0.6 // уровень засчитан, если верных >= 60%
const FAIL_EARLY = 0.4 // блок провален с треском — дальше не спрашиваем

/** Считает уровень: высший, где доля верных >= 60% и все нижние тоже пройдены. */
function scoreLevel(
  levels: CEFRLevel[],
  questions: PlacementQuestion[],
  answers: Record<number, number>,
): CEFRLevel {
  let result: CEFRLevel = 'A1'
  for (const level of levels) {
    const qs = questions.filter((q) => q.level === level)
    if (qs.length === 0) continue
    const correct = qs.filter((q) => answers[q.id] === q.answer).length
    if (correct / qs.length >= PASS) result = level
    else break
  }
  return result
}

export function PlacementTest() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang } = useLanguage()
  const levels = LEVELS_BY_LANG[lang]
  const [all, setAll] = useState<PlacementQuestion[] | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    let alive = true
    setAll(null)
    const bank =
      lang === 'es'
        ? import('../../data/spanish/placement')
        : import('../../data/english/placement')
    bank.then((m) => {
      if (alive) setAll(m.placementQuestions)
    })
    return () => {
      alive = false
    }
  }, [lang])

  // По 10 случайных вопросов на уровень, от простого к сложному.
  const questions = useMemo(() => {
    if (!all) return []
    const picked: PlacementQuestion[] = []
    for (const level of levels) {
      picked.push(...shuffle(all.filter((q) => q.level === level)).slice(0, PER_LEVEL))
    }
    return picked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, started])

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  const back = () => navigate('/')

  const restart = () => {
    setAnswers({})
    setIndex(0)
    setDone(false)
    setStarted(false)
  }

  // смена языка посреди теста — начинаем заново на новом банке
  useEffect(restart, [lang])

  if (!all) {
    return (
      <div className="flex flex-col gap-4">
        <TopBack onBack={back} />
        <p className="text-[var(--night-text-40)]">Загрузка…</p>
      </div>
    )
  }

  const languageName = lang === 'es' ? 'испанского' : 'английского'
  const maxQuestions = levels.length * PER_LEVEL

  // Интро
  if (!started) {
    return (
      <div className="flex flex-col gap-4">
        <TopBack onBack={back} />
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--night-accent-900)] text-[var(--night-accent-100)]">
            <IconSparkle size={30} />
          </div>
          <h1 className="text-2xl font-medium tracking-tight">
            Тест уровня {languageName}
          </h1>
          <p className="max-w-sm text-[var(--night-text-40)]">
            До {maxQuestions} вопросов от простого к сложному, блоками по
            уровням {levels[0]}–{levels[levels.length - 1]}. Если блок окажется
            слишком сложным, тест закончится раньше. Результат подстроит
            «Диалог» и подсказки под тебя.
          </p>
        </div>
        <Button onClick={() => setStarted(true)}>Начать тест</Button>
      </div>
    )
  }

  // Результат
  if (done) {
    const level = scoreLevel(levels, questions, answers)
    const save = async () => {
      setSaving(true)
      try {
        if (lang === 'es') {
          setEsLevel(level)
        } else if (user) {
          await supabase.from('profiles').update({ level }).eq('id', user.id)
          invalidateProfile() // иначе кэш (Учёба, игры, промпты) не увидит новый уровень
        }
        // если тест назначал преподаватель — закрываем просьбу и отдаём ему
        // результат (по испанскому уровень иначе остался бы только на телефоне)
        await reportPlacementResult(lang, level)
        navigate('/')
      } finally {
        setSaving(false)
      }
    }
    return (
      <div className="flex flex-col gap-4">
        <TopBack onBack={back} />
        <Card className="items-center text-center">
          <p className="text-sm text-[var(--night-text-40)]">Твой уровень</p>
          <p className="my-2 text-5xl font-bold text-[var(--night-accent-text)]">{level}</p>
          <p className="text-sm text-[var(--night-text-40)]">
            {level === 'A1'
              ? 'Начинаем с самых основ — это нормально!'
              : level === levels[levels.length - 1]
                ? 'Отличный уровень — будем поддерживать и расширять.'
                : 'Хорошая база — есть куда расти.'}
          </p>
        </Card>
        <Button loading={saving} onClick={save}>
          Сохранить уровень
        </Button>
        <Button variant="ghost" onClick={restart}>
          Пройти заново
        </Button>
      </div>
    )
  }

  // Вопрос
  const q = questions[index]
  const total = questions.length
  const choose = (optIndex: number) => {
    const next = { ...answers, [q.id]: optIndex }
    setAnswers(next)
    const nextQ = questions[index + 1]
    if (!nextQ) {
      setDone(true)
      return
    }
    // конец блока уровня: провален с треском — дальше не мучаем
    if (nextQ.level !== q.level) {
      const qs = questions.filter((x) => x.level === q.level)
      const correct = qs.filter((x) => next[x.id] === x.answer).length
      if (correct / qs.length < FAIL_EARLY) {
        setDone(true)
        return
      }
    }
    setIndex((i) => i + 1)
  }

  return (
    <div className="flex flex-col gap-4">
      <TopBack onBack={back} />

      {/* Прогресс */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-[var(--night-text-40)]">
          <span>Вопрос {index + 1} из {total}</span>
          <span>{q.level}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-[var(--night-accent)] transition-all duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <Card key={index} className="flex animate-fade-in flex-col gap-3">
        <p className="text-lg font-medium">{q.prompt}</p>
        <div className="flex flex-col gap-2">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => choose(i)}
              className="rounded-xl border border-white/[0.10] px-4 py-2.5 text-left transition-colors hover:border-[var(--night-accent-45)] hover:bg-[rgba(145,132,217,.10)]"
            >
              {opt}
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}

function TopBack({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-[var(--night-text-40)] hover:text-[var(--night-text-70)]"
    >
      <IconBack size={16} /> На главную
    </button>
  )
}
