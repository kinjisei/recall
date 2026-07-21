// ============================================================================
// Раздел «Глаголы» экрана «Грамматика»: спряжения испанских глаголов.
//   • Справочник — 14 времён: окончания -AR/-ER/-IR + таблицы примеров глаголов;
//   • Тренажёр — 110 упражнений на выбор правильной формы, с объяснением.
// Данные грузятся лениво (../../data/spanish/conjugation).
// ============================================================================
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { SpeakerHighIcon } from '@phosphor-icons/react'
import { BackButton } from '../../components/BackButton'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { RoundResult, RoundProgress } from '../../components/RoundResult'
import { speak } from '../../lib/speech'
import { logActivity } from '../../lib/activity'
import type {
  ConjugationReference,
  ConjugationTense,
  EndingsExercise,
} from '../../types'

const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const

type Tab = 'reference' | 'trainer'

interface Data {
  reference: ConjugationReference
  exercises: EndingsExercise[]
}

export function ConjugationSection() {
  const [data, setData] = useState<Data | null>(null)
  const [tab, setTab] = useState<Tab>('reference')

  useEffect(() => {
    let alive = true
    import('../../data/spanish/conjugation').then((m) => {
      if (alive)
        setData({ reference: m.conjugationReference, exercises: m.endingsExercises })
    })
    return () => {
      alive = false
    }
  }, [])

  if (!data) return <p className="text-[var(--night-text-40)]">Загрузка…</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <SubTab active={tab === 'reference'} onClick={() => setTab('reference')}>
          📋 Справочник
        </SubTab>
        <SubTab active={tab === 'trainer'} onClick={() => setTab('trainer')}>
          🎯 Тренажёр
        </SubTab>
      </div>

      {tab === 'reference' ? (
        <ReferenceView reference={data.reference} />
      ) : (
        <TrainerView exercises={data.exercises} />
      )}
    </div>
  )
}

function SubTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold ${
        active
          ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
          : 'bg-white/[0.07] text-[var(--night-text-70)]'
      }`}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Справочник: список времён по уровням → детальный экран времени.
// ---------------------------------------------------------------------------

function ReferenceView({ reference }: { reference: ConjugationReference }) {
  const [openLevel, setOpenLevel] = useState<string | null>('A1')
  const [selected, setSelected] = useState<ConjugationTense | null>(null)

  const byLevel = useMemo(() => {
    const groups: Record<string, ConjugationTense[]> = { A1: [], A2: [], B1: [], B2: [] }
    for (const t of reference.tenses) {
      const level = LEVELS.includes(t.level as (typeof LEVELS)[number]) ? t.level : 'A1'
      groups[level]?.push(t)
    }
    return groups
  }, [reference])

  if (selected) {
    return (
      <TenseDetail
        tense={selected}
        persons={reference.persons}
        onBack={() => setSelected(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {LEVELS.map((level) => {
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
                <span className="font-normal text-[var(--night-text-40)]">· {list.length} времён</span>
              </span>
              <span className="text-[var(--night-text-40)]">{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div className="mt-2 flex flex-col gap-2">
                {list.map((t) => (
                  <button key={t.id} onClick={() => setSelected(t)} className="text-left">
                    <Card className="transition-transform active:scale-[0.99]">
                      <p className="font-medium">{t.nameRu}</p>
                      <p className="text-xs text-[var(--night-text-40)]">{t.name}</p>
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TenseDetail({
  tense,
  persons,
  onBack,
}: {
  tense: ConjugationTense
  persons: string[]
  onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <BackButton onClick={onBack} />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-medium tracking-tight">{tense.nameRu}</h2>
          <p className="truncate text-sm text-[var(--night-text-40)]">{tense.name}</p>
        </div>
      </div>

      <Card className="flex flex-col gap-2">
        <p className="text-sm text-[var(--night-text-70)]">{tense.usage}</p>
        <div className="rounded-lg bg-white/[0.06] px-3 py-2 dark:bg-[var(--night-surface)]">
          <div className="flex items-center gap-2">
            <p className="font-medium">{tense.example}</p>
            <button
              onClick={() => speak(tense.example, { lang: 'es' })}
              className="rounded-full bg-[var(--night-surface)] px-2 py-1 dark:bg-white/[0.08]"
              aria-label="Озвучить"
            >
              <SpeakerHighIcon size={15} />
            </button>
          </div>
          <p className="mt-0.5 text-sm text-[var(--night-text-40)]">{tense.exampleRu}</p>
        </div>
      </Card>

      {/* Окончания по группам глаголов */}
      <div>
        <h3 className="mb-2 text-sm font-bold">Окончания</h3>
        <ConjTable
          persons={persons}
          firstHeader=""
          rows={tense.endings.map((e) => ({ head: e.label, cells: e.forms }))}
        />
      </div>

      {/* Примеры глаголов */}
      <div>
        <h3 className="mb-2 text-sm font-bold">Примеры глаголов</h3>
        <ConjTable
          persons={persons}
          firstHeader="глагол"
          rows={tense.verbs.map((v) => ({
            head: `${v.infinitive}${v.irregular ? ' ⚠️' : ''}`,
            sub: v.ru,
            cells: v.forms,
          }))}
        />
        <p className="mt-1 text-xs text-[var(--night-text-40)]">⚠️ — неправильный глагол</p>
      </div>
    </div>
  )
}

/** Общая таблица спряжения: шапка = лица, слева — метка строки. */
function ConjTable({
  persons,
  firstHeader,
  rows,
}: {
  persons: string[]
  firstHeader: string
  rows: { head: string; sub?: string; cells: string[] }[]
}) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-white/[0.08] bg-white/[0.06] px-2 py-1 text-left font-semibold dark:border-white/[0.08] dark:bg-[var(--night-surface)]">
              {firstHeader}
            </th>
            {persons.map((p, i) => (
              <th
                key={i}
                className="whitespace-nowrap border border-white/[0.08] bg-white/[0.06] px-2 py-1 text-left font-semibold dark:border-white/[0.08] dark:bg-[var(--night-surface)]"
              >
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              <td className="whitespace-nowrap border border-white/[0.08] px-2 py-1 font-medium dark:border-white/[0.08]">
                {row.head}
                {row.sub && (
                  <span className="block text-xs font-normal text-[var(--night-text-40)]">
                    {row.sub}
                  </span>
                )}
              </td>
              {row.cells.map((c, ci) => (
                <td
                  key={ci}
                  className="whitespace-nowrap border border-white/[0.08] px-2 py-1 dark:border-white/[0.08]"
                >
                  {c}
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
// Тренажёр окончаний: выбор правильной формы, с объяснением.
// ---------------------------------------------------------------------------

function TrainerView({ exercises }: { exercises: EndingsExercise[] }) {
  const [level, setLevel] = useState<string>('all')

  const pool = useMemo(
    () => (level === 'all' ? exercises : exercises.filter((e) => e.level === level)),
    [exercises, level],
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(['all', ...LEVELS] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              level === l
                ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                : 'bg-white/[0.07] text-[var(--night-text-70)]'
            }`}
          >
            {l === 'all' ? 'Все' : l}
          </button>
        ))}
      </div>
      {/* key: при смене уровня перезапускаем прогон с начала */}
      <TrainerRunner key={level} pool={pool} />
    </div>
  )
}

function TrainerRunner({ pool }: { pool: EndingsExercise[] }) {
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [done, setDone] = useState(false)

  const total = pool.length
  const current = pool[index]

  if (total === 0) {
    return <Card>Нет упражнений для этого уровня.</Card>
  }

  if (done) {
    return (
      <RoundResult
        correct={correct}
        total={total}
        note="Засчитано в серию дня."
        restartLabel="Ещё раз"
        onRestart={() => {
          setIndex(0)
          setCorrect(0)
          setPicked(null)
          setDone(false)
        }}
      />
    )
  }

  const choose = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    if (i === current.answer) setCorrect((c) => c + 1)
  }

  const next = () => {
    if (index + 1 >= total) {
      setDone(true)
      void logActivity('grammar')
    } else {
      setIndex((i) => i + 1)
      setPicked(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <RoundProgress index={index + 1} total={total} correct={correct} />

      <Card className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--night-accent-text)]">
          {current.rule}
        </p>
        <p className="text-lg font-medium">{current.prompt}</p>
        <p className="text-sm text-[var(--night-text-40)]">
          глагол: <b>{current.infinitive}</b>
        </p>

        <div className="flex flex-col gap-2">
          {current.options.map((opt, i) => {
            const isAnswer = i === current.answer
            const isPicked = i === picked
            let cls = 'border-white/[0.10] hover:border-[var(--night-accent-45)]'
            if (picked !== null) {
              if (isAnswer) cls = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
              else if (isPicked) cls = 'border-red-500 bg-red-50 dark:bg-red-950/40'
              else cls = 'border-white/[0.08] opacity-60'
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

        {picked !== null && (
          <>
            <p className="rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-[var(--night-text-70)] dark:bg-[var(--night-surface)] dark:text-[var(--night-text-25)]">
              {current.explanation}
            </p>
            <Button onClick={next}>
              {index + 1 >= total ? 'Завершить' : 'Дальше →'}
            </Button>
          </>
        )}
      </Card>
    </div>
  )
}
