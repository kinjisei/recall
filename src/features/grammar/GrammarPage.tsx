// ============================================================================
// «Грамматика» — уроки для обоих языков: испанские A1–B2 (из приложения
// spanish) и английские (авторские, пополняются). Список тем по уровням →
// теория (paragraph/table/example) → интерактивные упражнения (mcq/fill/order)
// с проверкой. Завершение упражнений засчитывается в стрик (logActivity).
// Раздел «Глаголы»: ES — спряжения (ConjugationSection), EN — неправильные
// глаголы (IrregularVerbsSection).
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  IconArrowRight,
  IconGap,
  IconRefresh,
  IconShuffle,
  IconSpeaker,
  IconWarning,
  type IconProps,
  IconCaretDown,
} from '../../components/icons'
import { BackHeader } from '../../components/BackButton'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { RoundResult, RoundProgress } from '../../components/RoundResult'
import { speak } from '../../lib/speech'
import { logActivity } from '../../lib/activity'
import { addMistake, getMistakes, removeMistake, type GrammarMistake } from '../../lib/mistakes'
import { useLanguage } from '../../context/LanguageContext'
import { ExerciseView } from '../../components/exercises'
import { ConjugationSection } from './ConjugationSection'
import { IrregularVerbsSection } from './IrregularVerbsSection'
import type {
  AppLang,
  GrammarExercise,
  GrammarTheoryBlock,
  GrammarTopic,
} from '../../types'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

type Section = 'lessons' | 'verbs'

const sections: { id: Section; label: string; Icon: (p: IconProps) => React.JSX.Element }[] = [
  { id: 'lessons', label: 'Уроки', Icon: IconGap },
  { id: 'verbs', label: 'Глаголы', Icon: IconShuffle },
]

/**
 * «Грамматика»: уроки (EN и ES) + глаголы (ES — спряжения, EN — неправильные).
 * Query-параметры для входа из «Практики»: ?verbs=1 — сразу раздел «Глаголы»,
 * ?mistakes=1 — сразу повтор банка «Мои ошибки».
 */
export function GrammarPage() {
  const { lang } = useLanguage()
  const [params] = useSearchParams()
  const [section, setSection] = useState<Section>(() =>
    params.get('verbs') ? 'verbs' : 'lessons',
  )

  // при смене языка возвращаемся к урокам (контент «Глаголов» разный)
  useEffect(() => {
    setSection(params.get('verbs') ? 'verbs' : 'lessons')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-medium tracking-tight">Грамматика</h1>
      {
        <div className="flex gap-2">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`flex min-h-[44px] items-center gap-1.5 rounded-lg px-4 text-sm font-semibold ${
                section === s.id
                  ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                  : 'bg-white/[0.07] text-[var(--night-text-70)]'
              }`}
            >
              <s.Icon size={16} />
              {s.label}
            </button>
          ))}
        </div>
      }

      {section === 'lessons' ? (
        <LessonsSection key={lang} lang={lang} initialMistakes={params.get('mistakes') === '1'} />
      ) : lang === 'es' ? (
        <ConjugationSection />
      ) : (
        <IrregularVerbsSection />
      )}
    </div>
  )
}

function LessonsSection({
  lang,
  initialMistakes = false,
}: {
  lang: AppLang
  initialMistakes?: boolean
}) {
  const [topics, setTopics] = useState<GrammarTopic[] | null>(null)
  const [openLevel, setOpenLevel] = useState<string | null>('A1')
  const [selected, setSelected] = useState<GrammarTopic | null>(null)
  const [reviewMistakes, setReviewMistakes] = useState(initialMistakes)

  // При открытии темы (и возврате к списку) прокручиваем наверх — иначе
  // урок открывался на прежней прокрутке списка, показывая свою нижнюю часть.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [selected])
  // пересчитываем счётчик при каждом возврате к списку
  const mistakeCount = useMemo(
    () => (topics ? collectMistakes(lang, topics).length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, topics, selected, reviewMistakes],
  )

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
  if (reviewMistakes && topics) {
    return (
      <MistakesScreen lang={lang} topics={topics} onBack={() => setReviewMistakes(false)} />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--night-text-40)]">
        {lang === 'es'
          ? 'Уроки испанской грамматики от A1 до B2: короткая теория и упражнения с проверкой.'
          : 'Уроки английской грамматики: короткая теория и упражнения с проверкой. Разделы пополняются.'}
      </p>

      {mistakeCount > 0 && (
        <button onClick={() => setReviewMistakes(true)} className="text-left">
          <Card className="flex items-center justify-between gap-2 border-[var(--night-accent-45)] transition-transform active:scale-[0.99]">
            <span className="flex min-w-0 items-center gap-2 font-medium">
              <IconRefresh size={18} className="shrink-0 text-[var(--night-accent-text)]" />
              Мои ошибки
            </span>
            <span className="flex-none rounded-full bg-[var(--night-accent)] px-2 py-0.5 text-xs font-medium text-white">
              {mistakeCount}
            </span>
          </Card>
        </button>
      )}

      {!topics ? (
        <p className="text-[var(--night-text-40)]">Загрузка…</p>
      ) : (
        LEVELS.map((level) => {
          const list = byLevel[level] ?? []
          if (list.length === 0) return null
          const isOpen = openLevel === level
          return (
            <div key={level}>
              <button
                onClick={() => setOpenLevel((cur) => (cur === level ? null : level))}
                className="flex min-h-11 w-full items-center justify-between rounded-lg bg-white/[0.06] px-3 py-2 text-left dark:bg-[var(--night-surface)]"
              >
                <span className="text-sm font-bold">
                  Уровень {level}{' '}
                  <span className="font-normal text-[var(--night-text-40)]">· {list.length} тем</span>
                </span>
                <span className="text-[var(--night-text-40)]">
                  {isOpen ? <IconCaretDown size={16} /> : <IconArrowRight size={16} />}
                </span>
              </button>

              {isOpen && (
                <div className="mt-2 flex flex-col gap-2">
                  {list.map((t) => (
                    <button key={t.id} onClick={() => setSelected(t)} className="text-left">
                      <Card className="flex items-center justify-between gap-2 transition-transform active:scale-[0.99]">
                        <span className="min-w-0 truncate font-medium">{t.title}</span>
                        <span className="shrink-0 text-xs text-[var(--night-text-40)]">
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

  // при переключении теория↔упражнения — тоже наверх
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [mode])

  return (
    <div className="flex flex-col gap-4">
      <BackHeader onBack={onBack} title={topic.title} />

      <div className="flex gap-2">
        <button
          onClick={() => setMode('theory')}
          className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${
            mode === 'theory'
              ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
              : 'bg-white/[0.07] text-[var(--night-text-70)]'
          }`}
        >
          Теория
        </button>
        {topic.exercises.length > 0 && (
          <button
            onClick={() => setMode('exercises')}
            className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${
              mode === 'exercises'
                ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                : 'bg-white/[0.07] text-[var(--night-text-70)]'
            }`}
          >
            Упражнения ({topic.exercises.length})
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
        <ExercisesRunner topic={topic} lang={lang} onBackToTheory={() => setMode('theory')} />
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
    // абзацы «⚠️ типичная ошибка» — в аккуратный callout с иконкой вместо эмодзи
    if (block.text.startsWith('⚠')) {
      return (
        <div className="flex gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2">
          <IconWarning size={16} className="mt-0.5 shrink-0 text-amber-400" />
          <p className="leading-relaxed text-amber-100/90">
            {block.text.replace(/^⚠️?\s*/, '')}
          </p>
        </div>
      )
    }
    return <p className="leading-relaxed text-[var(--night-text-70)]">{block.text}</p>
  }
  if (block.type === 'example') {
    // текст примера: испанские уроки хранят его в es, английские — в en
    const sample = block.es ?? block.en ?? ''
    return (
      <div className="rounded-xl bg-white/[0.06] px-3 py-2 dark:bg-[var(--night-surface)]">
        <div className="flex items-center gap-2">
          <p className="font-medium text-[var(--night-text)]">{sample}</p>
          <button
            onClick={() => speak(sample, { lang })}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[var(--night-text-70)]"
            aria-label="Озвучить"
          >
            <IconSpeaker size={16} />
          </button>
        </div>
        <p className="mt-0.5 text-sm text-[var(--night-text-40)]">{block.ru}</p>
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
                className="border border-white/[0.08] bg-white/[0.06] px-2 py-1 text-left font-semibold dark:border-white/[0.08] dark:bg-[var(--night-surface)]"
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
                  className="border border-white/[0.08] px-2 py-1 dark:border-white/[0.08]"
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
  lang,
  onBackToTheory,
}: {
  topic: GrammarTopic
  lang: AppLang
  onBackToTheory: () => void
}) {
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)

  const total = topic.exercises.length
  const current = topic.exercises[index]

  const onAnswered = (ok: boolean) => {
    // банк «Мои ошибки»: неверный ответ кладёт упражнение в банк,
    // верный — убирает (в т.ч. если оно попало туда в прошлый раз)
    const ref = { topicId: topic.id, ex: index }
    if (ok) {
      setCorrect((c) => c + 1)
      removeMistake(lang, ref)
    } else {
      addMistake(lang, ref)
    }
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
    return (
      <RoundResult
        correct={correct}
        total={total}
        note="Тема засчитана в серию дня."
        restartLabel="Ещё раз"
        onRestart={() => {
          setIndex(0)
          setCorrect(0)
          setDone(false)
        }}
        extra={
          <Button variant="ghost" onClick={onBackToTheory}>
            К теории
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <RoundProgress index={index + 1} total={total} correct={correct} progressLabel="Упражнение" />
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

// ---------------------------------------------------------------------------
// «Мои ошибки»: повтор упражнений, где пользователь ошибался (lib/mistakes).
// ---------------------------------------------------------------------------

interface MistakeItem {
  ref: GrammarMistake
  exercise: GrammarExercise
  topicTitle: string
}

/** Валидные записи банка ошибок (устаревшие — темы/упражнения исчезли — пропускаем). */
function collectMistakes(lang: AppLang, topics: GrammarTopic[]): MistakeItem[] {
  const out: MistakeItem[] = []
  for (const ref of getMistakes(lang)) {
    const topic = topics.find((t) => t.id === ref.topicId)
    const exercise = topic?.exercises[ref.ex]
    if (topic && exercise) out.push({ ref, exercise, topicTitle: topic.title })
  }
  return out
}

function MistakesScreen({
  lang,
  topics,
  onBack,
}: {
  lang: AppLang
  topics: GrammarTopic[]
  onBack: () => void
}) {
  // снимок банка на момент открытия — верные ответы убирают запись из банка,
  // но текущий раунд идёт по снимку до конца
  const [items] = useState(() => collectMistakes(lang, topics))
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)

  const total = items.length
  const current = items[index]

  const onAnswered = (ok: boolean) => {
    if (ok) {
      setCorrect((c) => c + 1)
      removeMistake(lang, current.ref)
    }
  }

  const next = () => {
    if (index + 1 >= total) {
      setDone(true)
      void logActivity('grammar')
    } else {
      setIndex((i) => i + 1)
    }
  }

  if (total === 0 || done) {
    return (
      <div className="flex flex-col gap-4">
        <BackHeader onBack={onBack} title="Мои ошибки" />
        {total === 0 ? (
          <Card className="text-center">
            <p className="font-semibold">Ошибок на повтор нет</p>
            <p className="mt-1 text-sm text-[var(--night-text-40)]">
              Ошибки из уроков будут копиться здесь — и исчезать после верного ответа.
            </p>
          </Card>
        ) : (
          <RoundResult
            correct={correct}
            total={total}
            note="Верно решённые упражнения ушли из банка ошибок."
            restartLabel="К урокам"
            onRestart={onBack}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <BackHeader onBack={onBack} title="Мои ошибки" />
      <RoundProgress index={index + 1} total={total} correct={correct} progressLabel="Ошибка" />
      <p className="text-sm text-[var(--night-text-40)]">Тема: {current.topicTitle}</p>
      <ExerciseView
        key={index}
        exercise={current.exercise}
        onAnswered={onAnswered}
        onNext={next}
        isLast={index + 1 >= total}
      />
    </div>
  )
}

