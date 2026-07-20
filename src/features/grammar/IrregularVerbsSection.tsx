// ============================================================================
// «Глаголы» для английского: неправильные глаголы.
// «Справочник» — группы по типу изменения (put-put-put, buy-bought-bought…)
// с озвучкой; «Тренажёр» — раунд из 10 случайных глаголов: показываем базу
// и перевод, пользователь печатает 2-ю и 3-ю формы. Итог раунда → стрик.
// Данные ленивые: src/data/english/irregular.ts.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { speak } from '../../lib/speech'
import { logActivity } from '../../lib/activity'
import type {
  IrregularGroup,
  IrregularVerb,
} from '../../data/english/irregular'

const ROUND_SIZE = 10

type Mode = 'reference' | 'trainer'

export function IrregularVerbsSection() {
  const [groups, setGroups] = useState<IrregularGroup[] | null>(null)
  const [mode, setMode] = useState<Mode>('reference')

  useEffect(() => {
    let alive = true
    import('../../data/english/irregular').then((m) => {
      if (alive) setGroups(m.irregularGroups)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!groups) return <p className="text-slate-500">Загрузка…</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(
          [
            ['reference', '📋 Справочник'],
            ['trainer', '⚡ Тренажёр'],
          ] as [Mode, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              mode === id
                ? 'bg-sky-600 text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'reference' ? <Reference groups={groups} /> : <Trainer groups={groups} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Справочник: группы по типу изменения + поиск.
// ---------------------------------------------------------------------------

function Reference({ groups }: { groups: IrregularGroup[] }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(groups[0]?.title ?? null)

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return groups
    return groups
      .map((g) => ({
        ...g,
        verbs: g.verbs.filter(
          (v) =>
            v.base.includes(q) || v.past.includes(q) || v.part.includes(q) || v.ru.includes(q),
        ),
      }))
      .filter((g) => g.verbs.length > 0)
  }, [groups, q])

  const total = groups.reduce((n, g) => n + g.verbs.length, 0)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-500">
        {total} самых нужных неправильных глаголов, сгруппированных по типу изменения —
        так закономерности видны и запоминаются легче.
      </p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск: go, went, идти…"
        className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 dark:border-slate-600 dark:bg-slate-800"
      />

      {filtered.map((g) => {
        const isOpen = q !== '' || open === g.title
        return (
          <div key={g.title}>
            <button
              onClick={() => setOpen((cur) => (cur === g.title ? null : g.title))}
              className="flex w-full items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-left dark:bg-slate-800"
            >
              <span className="text-sm font-bold">
                {g.title}{' '}
                <span className="font-normal text-slate-400">· {g.verbs.length}</span>
              </span>
              <span className="text-slate-400">{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <Card className="mt-2 overflow-x-auto p-0">
                <p className="px-3 pt-3 text-xs text-slate-500">{g.note}</p>
                <table className="mt-2 min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400">
                      <th className="px-3 py-1.5 font-semibold">V1</th>
                      <th className="px-3 py-1.5 font-semibold">V2</th>
                      <th className="px-3 py-1.5 font-semibold">V3</th>
                      <th className="px-3 py-1.5 font-semibold">перевод</th>
                      <th className="px-1 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {g.verbs.map((v) => (
                      <tr key={v.base} className="border-t border-slate-100 dark:border-slate-700/60">
                        <td className="px-3 py-1.5 font-semibold">{v.base}</td>
                        <td className="px-3 py-1.5">{v.past}</td>
                        <td className="px-3 py-1.5">{v.part}</td>
                        <td className="px-3 py-1.5 text-slate-500">{v.ru}</td>
                        <td className="px-1 py-1.5">
                          <button
                            onClick={() =>
                              speak(`${v.base}, ${v.past.split('/')[0]}, ${v.part.split('/')[0]}`, {
                                lang: 'en',
                              })
                            }
                            className="rounded-full px-1.5 text-sm"
                            aria-label={`Озвучить ${v.base}`}
                          >
                            🔊
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Тренажёр: печатаем 2-ю и 3-ю формы по базе и переводу.
// ---------------------------------------------------------------------------

/** Ответ верен, если совпал с любым из вариантов через «/» (was/were). */
function matches(given: string, expected: string): boolean {
  const norm = given.trim().toLowerCase()
  return expected.split('/').some((alt) => alt.trim().toLowerCase() === norm)
}

function sampleRound(all: IrregularVerb[]): IrregularVerb[] {
  const pool = [...all]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, ROUND_SIZE)
}

interface Result {
  verb: IrregularVerb
  ok: boolean
}

function Trainer({ groups }: { groups: IrregularGroup[] }) {
  const all = useMemo(() => groups.flatMap((g) => g.verbs), [groups])
  const [round, setRound] = useState<IrregularVerb[]>(() => sampleRound(all))
  const [index, setIndex] = useState(0)
  const [past, setPast] = useState('')
  const [part, setPart] = useState('')
  const [checked, setChecked] = useState(false)
  const [results, setResults] = useState<Result[]>([])
  const pastRef = useRef<HTMLInputElement>(null)

  const verb = round[index]
  const done = index >= round.length

  useEffect(() => {
    if (!done) pastRef.current?.focus()
  }, [index, done])

  const check = () => {
    if (checked) return
    setChecked(true)
    const ok = matches(past, verb.past) && matches(part, verb.part)
    setResults((r) => [...r, { verb, ok }])
    if (index + 1 >= round.length) void logActivity('grammar')
  }

  const next = () => {
    setIndex((i) => i + 1)
    setPast('')
    setPart('')
    setChecked(false)
  }

  const restart = () => {
    setRound(sampleRound(all))
    setIndex(0)
    setPast('')
    setPart('')
    setChecked(false)
    setResults([])
  }

  if (done) {
    const correct = results.filter((r) => r.ok).length
    const percent = Math.round((correct / round.length) * 100)
    const wrong = results.filter((r) => !r.ok)
    return (
      <Card className="flex flex-col gap-3">
        <div className="text-center">
          <p className="text-4xl">{percent >= 80 ? '🎉' : percent >= 50 ? '👍' : '💪'}</p>
          <p className="mt-2 text-lg font-bold">
            {correct} из {round.length} верно ({percent}%)
          </p>
          <p className="mt-1 text-sm text-slate-500">Раунд засчитан в серию дня.</p>
        </div>
        {wrong.length > 0 && (
          <div className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
            <p className="mb-1 font-semibold">Повтори:</p>
            {wrong.map(({ verb: v }) => (
              <p key={v.base}>
                {v.base} — {v.past} — {v.part}{' '}
                <span className="text-slate-500">({v.ru})</span>
              </p>
            ))}
          </div>
        )}
        <Button onClick={restart}>Ещё раунд</Button>
      </Card>
    )
  }

  const pastOk = checked && matches(past, verb.past)
  const partOk = checked && matches(part, verb.part)
  const inputCls = (ok: boolean) =>
    `rounded-xl border px-4 py-2.5 dark:bg-slate-800 ${
      !checked
        ? 'border-slate-300 bg-white dark:border-slate-600'
        : ok
          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
          : 'border-red-400 bg-red-50 dark:bg-red-950/40'
    }`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          Глагол {index + 1} / {round.length}
        </span>
        <span>верно: {results.filter((r) => r.ok).length}</span>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="text-center">
          <p className="text-2xl font-bold">{verb.base}</p>
          <p className="text-sm text-slate-500">{verb.ru}</p>
        </div>

        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            check()
          }}
        >
          <input
            ref={pastRef}
            value={past}
            onChange={(e) => setPast(e.target.value)}
            placeholder="2-я форма (Past): went…"
            disabled={checked}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={inputCls(pastOk)}
          />
          <input
            value={part}
            onChange={(e) => setPart(e.target.value)}
            placeholder="3-я форма (V3): gone…"
            disabled={checked}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={inputCls(partOk)}
          />
          {checked && (!pastOk || !partOk) && (
            <p className="text-sm font-medium text-red-500">
              Правильно: {verb.base} — {verb.past} — {verb.part}
            </p>
          )}
          {checked && pastOk && partOk && (
            <p className="text-sm font-medium text-emerald-600">Верно! 🎉</p>
          )}
          {!checked ? (
            <Button type="submit" disabled={!past.trim() || !part.trim()}>
              Проверить
            </Button>
          ) : (
            <Button type="button" onClick={next}>
              {index + 1 >= round.length ? 'Итоги' : 'Дальше →'}
            </Button>
          )}
        </form>
      </Card>
    </div>
  )
}
