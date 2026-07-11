// ============================================================================
// «Грамматика» — уроки для обоих языков: испанские A1–B2 (из приложения
// spanish) и английские (авторские, пополняются). Список тем по уровням →
// теория (paragraph/table/example) → интерактивные упражнения (mcq/fill/order)
// с проверкой. Завершение упражнений засчитывается в стрик (logActivity).
// Раздел «Глаголы» (спряжения) — только для испанского.
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { speak } from '../../lib/speech'
import { logActivity } from '../../lib/activity'
import { useLanguage } from '../../context/LanguageContext'
import { ConjugationSection } from './ConjugationSection'
import type {
  AppLang,
  GrammarExercise,
  GrammarTheoryBlock,
  GrammarTopic,
} from '../../types'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

/** Нормализация ответа: без регистра, диакритики и лишних пробелов. */
export function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

type Section = 'lessons' | 'verbs'

const sections: { id: Section; label: string }[] = [
  { id: 'lessons', label: '📖 Уроки' },
  { id: 'verbs', label: '🔀 Глаголы' },
]

/** «Грамматика»: уроки (EN и ES) + спряжения глаголов (только ES). */
export function GrammarPage() {
  const { lang } = useLanguage()
  const [section, setSection] = useState<Section>('lessons')

  // при переключении на английский раздел «Глаголы» недоступен
  useEffect(() => {
    if (lang !== 'es') setSection('lessons')
  }, [lang])

  const visibleSections = lang === 'es' ? sections : sections.filter((s) => s.id === 'lessons')

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">📚 Грамматика</h1>
      {visibleSections.length > 1 && (
        <div className="flex gap-2">
          {visibleSections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                section === s.id
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {section === 'lessons' ? <LessonsSection key={lang} lang={lang} /> : <ConjugationSection />}
    </div>
  )
}

function LessonsSection({ lang }: { lang: AppLang }) {
  const [topics, setTopics] = useState<GrammarTopic[] | null>(null)
  const [openLevel, setOpenLevel] = useState<string | null>('A1')
  const [selected, setSelected] = useState<GrammarTopic | null>(null)

  useEffect(() => {
    let alive = true
    const mod =
      lang === 'es'
        ? import('../../data/spanish/grammar')
        : import('../../data/english/grammar')
    mod.then((m) => {
      if (alive) setTopics(m.grammarTopics)
    })
    return () => {
      alive = false
    }
  }, [lang])

  const byLevel = useMemo(() => {
    const groups: Record<string, GrammarTopic[]> = {}
    for (const t of topics ?? []) {
      const level = LEVELS.includes(t.level as (typeof LEVELS)[number]) ? t.level : 'A1'
      ;(groups[level] ??= []).push(t)
    }
    return groups
  }, [topics])

  if (selected) {
    return <TopicScreen topic={selected} lang={lang} onBack={() => setSelected(null)} />
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-500">
        {lang === 'es'
          ? 'Уроки испанской грамматики от A1 до B2: короткая теория и упражнения с проверкой.'
          : 'Уроки английской грамматики: короткая теория и упражнения с проверкой. Разделы пополняются.'}
      </p>

      {!topics ? (
        <p className="text-slate-500">Загрузка…</p>
      ) : (
        LEVELS.map((level) => {
          const list = byLevel[level] ?? []
          if (list.length === 0) return null
          const isOpen = openLevel === level
          return (
            <div key={level}>
              <button
                onClick={() => setOpenLevel((cur) => (cur === level ? null : level))}
                className="flex w-full items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-left dark:bg-slate-800"
              >
                <span className="text-sm font-bold">
                  Уровень {level}{' '}
                  <span className="font-normal text-slate-400">· {list.length} тем</span>
                </span>
                <span className="text-slate-400">{isOpen ? '▾' : '▸'}</span>
              </button>

              {isOpen && (
                <div className="mt-2 flex flex-col gap-2">
                  {list.map((t) => (
                    <button key={t.id} onClick={() => setSelected(t)} className="text-left">
                      <Card className="flex items-center justify-between gap-2 transition-transform active:scale-[0.99]">
                        <span className="min-w-0 truncate font-medium">{t.title}</span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {t.exercises.length} упр.
                        </span>
                      </Card>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Экран темы: теория, затем упражнения.
// ---------------------------------------------------------------------------

function TopicScreen({
  topic,
  lang,
  onBack,
}: {
  topic: GrammarTopic
  lang: AppLang
  onBack: () => void
}) {
  const [mode, setMode] = useState<'theory' | 'exercises'>('theory')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
          ← Назад
        </Button>
        <h1 className="min-w-0 truncate text-xl font-bold">{topic.title}</h1>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setMode('theory')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            mode === 'theory'
              ? 'bg-sky-600 text-white'
              : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
          }`}
        >
          📖 Теория
        </button>
        {topic.exercises.length > 0 && (
          <button
            onClick={() => setMode('exercises')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              mode === 'exercises'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            ✍️ Упражнения ({topic.exercises.length})
          </button>
        )}
      </div>

      {mode === 'theory' ? (
        <TheoryView
          topic={topic}
          lang={lang}
          onStart={
            topic.exercises.length > 0 ? () => setMode('exercises') : undefined
          }
        />
      ) : (
        <ExercisesRunner topic={topic} onBackToTheory={() => setMode('theory')} />
      )}
    </div>
  )
}

function TheoryView({
  topic,
  lang,
  onStart,
}: {
  topic: GrammarTopic
  lang: AppLang
  onStart?: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-4">
        {topic.theory.map((block, i) => (
          <TheoryBlock key={i} block={block} lang={lang} />
        ))}
      </Card>
      {onStart && <Button onClick={onStart}>Перейти к упражнениям →</Button>}
    </div>
  )
}

function TheoryBlock({ block, lang }: { block: GrammarTheoryBlock; lang: AppLang }) {
  if (block.type === 'paragraph') {
    return <p className="leading-relaxed text-slate-700 dark:text-slate-200">{block.text}</p>
  }
  if (block.type === 'example') {
    // текст примера: испанские уроки хранят его в es, английские — в en
    const sample = block.es ?? block.en ?? ''
    return (
      <div className="rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
        <div className="flex items-center gap-2">
          <p className="font-medium text-slate-800 dark:text-slate-100">{sample}</p>
          <button
            onClick={() => speak(sample, { lang })}
            className="rounded-full bg-white px-2 py-0.5 text-sm dark:bg-slate-700"
            aria-label="Озвучить"
          >
            🔊
          </button>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">{block.ru}</p>
      </div>
    )
  }
  // table
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            {block.headers.map((h, i) => (
              <th
                key={i}
                className="border border-slate-200 bg-slate-100 px-2 py-1 text-left font-semibold dark:border-slate-700 dark:bg-slate-800"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border border-slate-200 px-2 py-1 dark:border-slate-700"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Упражнения: одно за раз, с проверкой и итогом.
// ---------------------------------------------------------------------------

function ExercisesRunner({
  topic,
  onBackToTheory,
}: {
  topic: GrammarTopic
  onBackToTheory: () => void
}) {
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)

  const total = topic.exercises.length
  const current = topic.exercises[index]

  const onAnswered = (ok: boolean) => {
    if (ok) setCorrect((c) => c + 1)
  }

  const next = () => {
    if (index + 1 >= total) {
      setDone(true)
      void logActivity('grammar')
    } else {
      setIndex((i) => i + 1)
    }
  }

  if (done) {
    const percent = total ? Math.round((correct / total) * 100) : 0
    return (
      <Card className="text-center">
        <p className="text-4xl">{percent >= 80 ? '🎉' : percent >= 50 ? '👍' : '💪'}</p>
        <p className="mt-2 text-lg font-bold">
          {correct} из {total} верно ({percent}%)
        </p>
        <p className="mt-1 text-sm text-slate-500">Тема засчитана в серию дня.</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setIndex(0)
              setCorrect(0)
              setDone(false)
            }}
          >
            Ещё раз
          </Button>
          <Button variant="ghost" onClick={onBackToTheory}>
            К теории
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          Упражнение {index + 1} / {total}
        </span>
        <span>верно: {correct}</span>
      </div>
      <ExerciseView
        key={index}
        exercise={current}
        onAnswered={onAnswered}
        onNext={next}
        isLast={index + 1 >= total}
      />
    </div>
  )
}

function ExerciseView({
  exercise,
  onAnswered,
  onNext,
  isLast,
}: {
  exercise: GrammarExercise
  onAnswered: (ok: boolean) => void
  onNext: () => void
  isLast: boolean
}) {
  if (exercise.type === 'mcq') {
    return (
      <McqExercise
        exercise={exercise}
        onAnswered={onAnswered}
        onNext={onNext}
        isLast={isLast}
      />
    )
  }
  if (exercise.type === 'fill') {
    return (
      <FillExercise
        exercise={exercise}
        onAnswered={onAnswered}
        onNext={onNext}
        isLast={isLast}
      />
    )
  }
  return (
    <OrderExercise
      exercise={exercise}
      onAnswered={onAnswered}
      onNext={onNext}
      isLast={isLast}
    />
  )
}

function NextButton({ onNext, isLast }: { onNext: () => void; isLast: boolean }) {
  return (
    <Button onClick={onNext}>{isLast ? 'Завершить' : 'Дальше →'}</Button>
  )
}

function McqExercise({
  exercise,
  onAnswered,
  onNext,
  isLast,
}: {
  exercise: Extract<GrammarExercise, { type: 'mcq' }>
  onAnswered: (ok: boolean) => void
  onNext: () => void
  isLast: boolean
}) {
  const [picked, setPicked] = useState<number | null>(null)

  const choose = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    onAnswered(i === exercise.answer)
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-lg font-medium">{exercise.prompt}</p>
      <div className="flex flex-col gap-2">
        {exercise.options.map((opt, i) => {
          const isAnswer = i === exercise.answer
          const isPicked = i === picked
          let cls =
            'border-slate-300 dark:border-slate-600 hover:border-sky-400'
          if (picked !== null) {
            if (isAnswer) cls = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
            else if (isPicked) cls = 'border-red-500 bg-red-50 dark:bg-red-950/40'
            else cls = 'border-slate-200 dark:border-slate-700 opacity-60'
          }
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={picked !== null}
              className={`rounded-xl border px-4 py-2.5 text-left transition-colors ${cls}`}
            >
              {opt}
            </button>
          )
        })}
      </div>
      {picked !== null && <NextButton onNext={onNext} isLast={isLast} />}
    </Card>
  )
}

function FillExercise({
  exercise,
  onAnswered,
  onNext,
  isLast,
}: {
  exercise: Extract<GrammarExercise, { type: 'fill' }>
  onAnswered: (ok: boolean) => void
  onNext: () => void
  isLast: boolean
}) {
  const [value, setValue] = useState('')
  const [checked, setChecked] = useState(false)
  const [showHint, setShowHint] = useState(false)

  const ok = normalize(value) === normalize(exercise.answer)

  const check = () => {
    if (checked || !value.trim()) return
    setChecked(true)
    onAnswered(ok)
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-lg font-medium">{exercise.prompt}</p>
      <input
        className={`w-full rounded-lg border bg-white px-3 py-2 outline-none dark:bg-slate-900 ${
          checked
            ? ok
              ? 'border-emerald-500'
              : 'border-red-500'
            : 'border-slate-300 focus:border-sky-500 dark:border-slate-600'
        }`}
        placeholder="Ваш ответ…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && check()}
        disabled={checked}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />

      {!checked && exercise.hint && (
        <button
          onClick={() => setShowHint((s) => !s)}
          className="self-start text-xs font-semibold text-sky-600 dark:text-sky-400"
        >
          {showHint ? 'скрыть подсказку' : '💡 подсказка'}
        </button>
      )}
      {!checked && showHint && exercise.hint && (
        <p className="text-sm text-slate-500">{exercise.hint}</p>
      )}

      {checked && !ok && (
        <p className="text-sm">
          <span className="text-red-500">Верный ответ: </span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {exercise.answer}
          </span>
        </p>
      )}
      {checked && ok && (
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          Верно! ✓
        </p>
      )}

      {checked ? (
        <NextButton onNext={onNext} isLast={isLast} />
      ) : (
        <Button onClick={check} disabled={!value.trim()}>
          Проверить
        </Button>
      )}
    </Card>
  )
}

function OrderExercise({
  exercise,
  onAnswered,
  onNext,
  isLast,
}: {
  exercise: Extract<GrammarExercise, { type: 'order' }>
  onAnswered: (ok: boolean) => void
  onNext: () => void
  isLast: boolean
}) {
  // Перемешиваем слова для показа (в данных они часто уже в правильном порядке).
  const shuffled = useMemo(() => {
    const arr = exercise.words.map((w, i) => ({ w, i }))
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [exercise])

  const [built, setBuilt] = useState<{ w: string; i: number }[]>([])
  const [checked, setChecked] = useState(false)

  const usedIdx = new Set(built.map((b) => b.i))
  const ok =
    built.length === exercise.answer.length &&
    built.every((b, i) => b.w === exercise.answer[i])

  const check = () => {
    if (checked || built.length !== exercise.words.length) return
    setChecked(true)
    onAnswered(ok)
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-lg font-medium">{exercise.prompt}</p>

      {/* Собранное предложение */}
      <div
        className={`min-h-[48px] rounded-lg border-2 border-dashed p-2 ${
          checked
            ? ok
              ? 'border-emerald-500'
              : 'border-red-500'
            : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        <div className="flex flex-wrap gap-2">
          {built.map((b, i) => (
            <button
              key={i}
              onClick={() => !checked && setBuilt((arr) => arr.filter((_, j) => j !== i))}
              disabled={checked}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm text-white"
            >
              {b.w}
            </button>
          ))}
          {built.length === 0 && (
            <span className="px-1 py-1 text-sm text-slate-400">
              нажимайте слова снизу по порядку
            </span>
          )}
        </div>
      </div>

      {/* Банк слов */}
      <div className="flex flex-wrap gap-2">
        {shuffled.map((item) => (
          <button
            key={item.i}
            onClick={() => !checked && setBuilt((arr) => [...arr, item])}
            disabled={checked || usedIdx.has(item.i)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              usedIdx.has(item.i)
                ? 'border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600'
                : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            {item.w}
          </button>
        ))}
      </div>

      {checked && !ok && (
        <p className="text-sm">
          <span className="text-red-500">Правильно: </span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {exercise.answer.join(' ')}
          </span>
        </p>
      )}
      {checked && ok && (
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          Верно! ✓
        </p>
      )}

      {checked ? (
        <NextButton onNext={onNext} isLast={isLast} />
      ) : (
        <div className="flex gap-2">
          <Button
            onClick={check}
            disabled={built.length !== exercise.words.length}
            className="flex-1"
          >
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
