// ============================================================================
// «Грамматика» — уроки для обоих языков: испанские A1–B2 (из приложения
// spanish) и английские (авторские, пополняются). Список тем по уровням →
// теория (paragraph/table/example) → интерактивные упражнения (mcq/fill/order)
// с проверкой. Завершение упражнений засчитывается в стрик (logActivity).
// Раздел «Глаголы»: ES — спряжения (ConjugationSection), EN — неправильные
// глаголы (IrregularVerbsSection).
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { speak } from '../../lib/speech'
import { logActivity } from '../../lib/activity'
import { useLanguage } from '../../context/LanguageContext'
import { ExerciseView } from '../../components/exercises'
import { ConjugationSection } from './ConjugationSection'
import { IrregularVerbsSection } from './IrregularVerbsSection'
import type {
  AppLang,
  GrammarTheoryBlock,
  GrammarTopic,
} from '../../types'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

type Section = 'lessons' | 'verbs'

const sections: { id: Section; label: string }[] = [
  { id: 'lessons', label: '📖 Уроки' },
  { id: 'verbs', label: '🔀 Глаголы' },
]

/** «Грамматика»: уроки (EN и ES) + глаголы (ES — спряжения, EN — неправильные). */
export function GrammarPage() {
  const { lang } = useLanguage()
  const [section, setSection] = useState<Section>('lessons')

  // при смене языка возвращаемся к урокам (контент «Глаголов» разный)
  useEffect(() => {
    setSection('lessons')
  }, [lang])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">📚 Грамматика</h1>
      {
        <div className="flex gap-2">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                section === s.id
                  ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                  : 'bg-white/[0.07] text-[var(--night-text-70)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      }

      {section === 'lessons' ? (
        <LessonsSection key={lang} lang={lang} />
      ) : lang === 'es' ? (
        <ConjugationSection />
      ) : (
        <IrregularVerbsSection />
      )}
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
      <p className="text-sm text-[var(--night-text-40)]">
        {lang === 'es'
          ? 'Уроки испанской грамматики от A1 до B2: короткая теория и упражнения с проверкой.'
          : 'Уроки английской грамматики: короткая теория и упражнения с проверкой. Разделы пополняются.'}
      </p>

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
                className="flex w-full items-center justify-between rounded-lg bg-white/[0.06] px-3 py-2 text-left dark:bg-[var(--night-surface)]"
              >
                <span className="text-sm font-bold">
                  Уровень {level}{' '}
                  <span className="font-normal text-[var(--night-text-40)]">· {list.length} тем</span>
                </span>
                <span className="text-[var(--night-text-40)]">{isOpen ? '▾' : '▸'}</span>
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
              ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
              : 'bg-white/[0.07] text-[var(--night-text-70)]'
          }`}
        >
          📖 Теория
        </button>
        {topic.exercises.length > 0 && (
          <button
            onClick={() => setMode('exercises')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              mode === 'exercises'
                ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                : 'bg-white/[0.07] text-[var(--night-text-70)]'
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
            className="rounded-full bg-[var(--night-surface)] px-2 py-0.5 text-sm dark:bg-white/[0.08]"
            aria-label="Озвучить"
          >
            🔊
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
        <p className="mt-1 text-sm text-[var(--night-text-40)]">Тема засчитана в серию дня.</p>
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
      <div className="flex items-center justify-between text-sm text-[var(--night-text-40)]">
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

