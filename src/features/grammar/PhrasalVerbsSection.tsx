// ============================================================================
// «Глаголы» для английского: фразовые глаголы (рядом с неправильными).
// «Справочник» — аккордеоны по базовому глаголу (look → look for, look after…)
// с переводом, примером, пометкой «разделяемый» и озвучкой; поиск по фразе и
// переводу. «Тренажёр» — раунд из 10: показываем перевод и базовый глагол,
// ученик выбирает частицу из 4 вариантов. Итог раунда → стрик; ошибки —
// в блок «Повтори» на повторный раунд.
// Данные ленивые: src/data/english/phrasal.ts (~300 проверенных фраз).
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { IconSpeaker } from '../../components/icons'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { RoundResult, RoundProgress } from '../../components/RoundResult'
import { speak } from '../../lib/speech'
import { logActivity } from '../../lib/activity'
import { shuffle, sample } from '../../lib/random'
import type { PhrasalEntry, PhrasalItem } from '../../data/english/phrasal'

const ROUND_SIZE = 10

type Mode = 'reference' | 'trainer'

export function PhrasalVerbsSection() {
  const [entries, setEntries] = useState<PhrasalEntry[] | null>(null)
  const [mode, setMode] = useState<Mode>('reference')

  useEffect(() => {
    let alive = true
    import('../../data/english/phrasal').then((m) => {
      if (alive) setEntries(m.phrasalVerbs)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!entries) return <p className="text-[var(--night-text-40)]">Загрузка…</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(
          [
            ['reference', 'Справочник'],
            ['trainer', 'Тренажёр'],
          ] as [Mode, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${
              mode === id
                ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                : 'bg-white/[0.07] text-[var(--night-text-70)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'reference' ? <Reference entries={entries} /> : <Trainer entries={entries} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Справочник: аккордеоны по базовому глаголу + поиск.
// ---------------------------------------------------------------------------

function Reference({ entries }: { entries: PhrasalEntry[] }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(entries[0]?.verb ?? null)

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return entries
    return entries
      .map((e) => ({
        ...e,
        items: e.items.filter(
          (i) => i.phrase.toLowerCase().includes(q) || i.ru.toLowerCase().includes(q),
        ),
      }))
      .filter((e) => e.items.length > 0)
  }, [entries, q])

  const total = entries.reduce((n, e) => n + e.items.length, 0)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--night-text-40)]">
        {total} самых ходовых фразовых глаголов, сгруппированных по базовому глаголу.
        Пометка «разделяемый» — дополнение можно вставить внутрь: turn the light on.
      </p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск: look for, откладывать…"
        aria-label="Поиск по фразовым глаголам"
        className="rounded-xl border border-white/[0.10] bg-[var(--night-surface)] px-4 py-2.5"
      />

      {filtered.map((e) => {
        const isOpen = q !== '' || open === e.verb
        return (
          <div key={e.verb}>
            <button
              onClick={() => setOpen((cur) => (cur === e.verb ? null : e.verb))}
              className="flex min-h-[44px] w-full items-center justify-between rounded-lg bg-white/[0.06] px-3 py-2 text-left"
            >
              <span className="text-sm font-bold">
                {e.verb}{' '}
                <span className="font-normal text-[var(--night-text-40)]">· {e.items.length}</span>
              </span>
              <span className="text-[var(--night-text-40)]">{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <Card className="mt-2 flex flex-col gap-3">
                {e.items.map((i, idx) => (
                  <div key={`${i.phrase}-${idx}`} className="border-t border-white/[0.06] pt-2.5 first:border-t-0 first:pt-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 text-sm">
                        <span className="font-semibold">{i.phrase}</span>{' '}
                        <span className="text-[var(--night-text-40)]">— {i.ru}</span>
                      </p>
                      <span className="flex flex-none items-center gap-1.5">
                        {i.separable && (
                          <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10px] text-[var(--night-text-40)]">
                            разделяемый
                          </span>
                        )}
                        <span className="rounded bg-[var(--night-accent-900)] px-1.5 py-0.5 text-[10px] text-[var(--night-accent-100)]">
                          {i.level}
                        </span>
                        <button
                          onClick={() => speak(`${i.phrase}. ${i.example}`, { lang: 'en' })}
                          className="-m-2 rounded-full p-2"
                          aria-label={`Озвучить ${i.phrase}`}
                        >
                          <IconSpeaker size={15} />
                        </button>
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--night-text-60)]">
                      {i.example}
                      <span className="text-[var(--night-text-40)]"> — {i.exampleRu}</span>
                    </p>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Тренажёр: перевод + базовый глагол → выбрать частицу из 4.
// ---------------------------------------------------------------------------

interface Question {
  item: PhrasalItem
  verb: string
  /** Частица без базового глагола: «forward to», «up», «after»… */
  particle: string
  options: string[]
  answer: number
}

/** Частица = фраза без первого слова (базового глагола). */
function particleOf(item: PhrasalItem): string {
  return item.phrase.split(/\s+/).slice(1).join(' ')
}

function buildRound(entries: PhrasalEntry[]): Question[] {
  const all = entries.flatMap((e) => e.items.map((item) => ({ item, verb: e.verb })))
  const particles = [...new Set(all.map((x) => particleOf(x.item)))]
  const picked = sample(all, ROUND_SIZE)
  return picked.map(({ item, verb }) => {
    const correct = particleOf(item)
    // обманки: сначала частицы ЭТОГО же глагола (самые коварные), потом любые
    const own = entries
      .find((e) => e.verb === verb)!
      .items.map(particleOf)
      .filter((p) => p !== correct)
    const rest = particles.filter((p) => p !== correct && !own.includes(p))
    const distractors = [...new Set([...shuffle(own), ...shuffle(rest)])].slice(0, 3)
    const options = shuffle([correct, ...distractors])
    return { item, verb, particle: correct, options, answer: options.indexOf(correct) }
  })
}

function Trainer({ entries }: { entries: PhrasalEntry[] }) {
  const [round, setRound] = useState<Question[]>(() => buildRound(entries))
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [wrong, setWrong] = useState<Question[]>([])
  const [correct, setCorrect] = useState(0)
  const [logged, setLogged] = useState(false)

  const q = round[index]
  const done = index >= round.length

  // итог раунда — один раз в стрик
  useEffect(() => {
    if (done && !logged && round.length > 0) {
      setLogged(true)
      void logActivity('grammar', round.length)
    }
  }, [done, logged, round.length])

  const restart = (questions?: Question[]) => {
    setRound(questions ?? buildRound(entries))
    setIndex(0)
    setChosen(null)
    setWrong([])
    setCorrect(0)
    setLogged(false)
  }

  if (done) {
    return (
      <RoundResult
        correct={correct}
        total={round.length}
        note="Раунд засчитан в серию дня"
        onRestart={() => restart()}
      >
        {wrong.length > 0 && (
          <Card className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Повтори</p>
            {wrong.map((w, i) => (
              <p key={i} className="text-sm text-[var(--night-text-70)]">
                <span className="font-semibold">{w.item.phrase}</span> — {w.item.ru}
              </p>
            ))}
            <Button
              variant="secondary"
              className="mt-1 self-start px-3 py-2 text-sm"
              onClick={() => restart(shuffle(wrong))}
            >
              Раунд из ошибок ({wrong.length})
            </Button>
          </Card>
        )}
      </RoundResult>
    )
  }

  const pick = (i: number) => {
    if (chosen !== null) return
    setChosen(i)
    if (i === q.answer) setCorrect((c) => c + 1)
    else setWrong((w) => [...w, q])
    speak(q.item.phrase, { lang: 'en' })
  }

  return (
    <div className="flex flex-col gap-4">
      <RoundProgress index={index} total={round.length} correct={correct} />

      <Card className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="text-sm text-[var(--night-text-40)]">{q.item.ru}</p>
        <p className="text-2xl font-semibold">
          {q.verb} <span className="text-[var(--night-accent-text)]">___</span>
        </p>
        {chosen !== null && (
          <p className="animate-fade-in text-sm text-[var(--night-text-60)]">
            {q.item.example}
            <span className="text-[var(--night-text-40)]"> — {q.item.exampleRu}</span>
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        {q.options.map((opt, i) => {
          const state =
            chosen === null
              ? 'border-white/[0.12] text-[var(--night-text-70)]'
              : i === q.answer
                ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300'
                : i === chosen
                  ? 'border-red-400/60 bg-red-400/10 text-red-300'
                  : 'border-white/[0.08] text-[var(--night-text-40)]'
          return (
            <button
              key={opt}
              onClick={() => pick(i)}
              disabled={chosen !== null}
              className={`lift min-h-[52px] rounded-2xl border px-3 font-medium ${state}`}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {chosen !== null && (
        <Button
          onClick={() => {
            setIndex((i) => i + 1)
            setChosen(null)
          }}
        >
          {index + 1 === round.length ? 'Итоги' : 'Дальше'}
        </Button>
      )}
    </div>
  )
}
