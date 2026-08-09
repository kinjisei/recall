// ============================================================================
// «Глаголы» для английского: неправильные глаголы.
// «Справочник» — группы по типу изменения (put-put-put, buy-bought-bought…)
// с озвучкой; «Тренажёр» — раунд из 10 случайных глаголов: показываем базу
// и перевод, пользователь печатает 2-ю и 3-ю формы. Итог раунда → стрик.
// Данные ленивые: src/data/english/irregular.ts.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconSpeaker } from '../../components/icons'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { TabPicker } from '../../components/TabPicker'
import { RoundResult } from '../../components/RoundResult'
import { speak } from '../../lib/speech'
import { logActivity } from '../../lib/activity'
import { getVerbMistakes, addVerbMistake, removeVerbMistake } from '../../lib/verbMistakes'
import { answerMatches } from '../../lib/text'
import { useUrlState } from '../../lib/useUrlState'
import { RowsSkeleton } from '../../components/Loading'
import { Reveal } from '../../components/Reveal'
import type {
  IrregularGroup,
  IrregularVerb,
} from '../../data/english/irregular'

const ROUND_SIZE = 10

type Mode = 'reference' | 'trainer'

export function IrregularVerbsSection() {
  const [groups, setGroups] = useState<IrregularGroup[] | null>(null)
  // Режим — в адресе (?vm=trainer): «назад» из тренажёра должен возвращать в
  // справочник, а не выбрасывать из «Грамматики» (см. lib/useUrlState). Ход
  // самого раунда в адрес НЕ выносим — после F5 раунд честно начинается заново.
  const [vm, setVm] = useUrlState('vm', (v) => v === 'trainer')
  const mode: Mode = vm === 'trainer' ? 'trainer' : 'reference'
  const setMode = (m: Mode) => setVm(m === 'trainer' ? 'trainer' : null)

  useEffect(() => {
    let alive = true
    import('../../data/english/irregular').then((m) => {
      if (alive) setGroups(m.irregularGroups)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!groups) return <RowsSkeleton count={5} />

  return (
    <div className="flex flex-col gap-4">
      <TabPicker
        options={[
          { id: 'reference', label: 'Справочник' },
          { id: 'trainer', label: 'Тренажёр' },
        ]}
        value={mode}
        onChange={setMode}
        ariaLabel="Режим"
      />

      {mode === 'reference' ? <Reference groups={groups} /> : <Trainer groups={groups} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Справочник: группы по типу изменения + поиск.
// ---------------------------------------------------------------------------

function Reference({ groups }: { groups: IrregularGroup[] }) {
  const [query, setQuery] = useState('')
  // Ничего не раскрыто: экран открывается СПИСКОМ групп, а не одной развёрнутой.
  // Раньше первая группа была раскрыта — вход выглядел так, будто ты уже внутри
  // «put-put-put», и остальных групп будто нет. Список уроков ведёт себя так же.
  const [open, setOpen] = useState<string | null>(null)

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
      <p className="text-sm text-[var(--night-text-40)]">
        {total} самых нужных неправильных глаголов, сгруппированных по типу изменения —
        так закономерности видны и запоминаются легче.
      </p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск: go, went, идти…"
        className="rounded-xl border border-white/[0.10] bg-[var(--night-surface)] px-4 py-2.5"
      />

      {filtered.map((g) => {
        const isOpen = q !== '' || open === g.title
        return (
          <div key={g.title}>
            <button
              onClick={() => setOpen((cur) => (cur === g.title ? null : g.title))}
              className="flex w-full items-center justify-between rounded-lg bg-[var(--night-surface)] px-3 py-2 text-left"
            >
              <span className="text-sm font-bold">
                {g.title}{' '}
                <span className="font-normal text-[var(--night-text-40)]">· {g.verbs.length}</span>
              </span>
              <span className="text-[var(--night-text-40)]">{isOpen ? '▾' : '▸'}</span>
            </button>

            <Reveal open={isOpen}>
              <Card className="mt-2 overflow-x-auto p-0">
                <p className="px-3 pt-3 text-xs text-[var(--night-text-40)]">{g.note}</p>
                <table className="mt-2 min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--night-text-40)]">
                      <th className="px-3 py-1.5 font-semibold">V1</th>
                      <th className="px-3 py-1.5 font-semibold">V2</th>
                      <th className="px-3 py-1.5 font-semibold">V3</th>
                      <th className="px-3 py-1.5 font-semibold">перевод</th>
                      <th className="px-1 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {g.verbs.map((v) => (
                      <tr key={v.base} className="border-t border-slate-700/60">
                        <td className="px-3 py-1.5 font-semibold">{v.base}</td>
                        <td className="px-3 py-1.5">{v.past}</td>
                        <td className="px-3 py-1.5">{v.part}</td>
                        <td className="px-3 py-1.5 text-[var(--night-text-40)]">{v.ru}</td>
                        <td className="px-1 py-1.5">
                          <button
                            onClick={() =>
                              speak(`${v.base}, ${v.past.split('/')[0]}, ${v.part.split('/')[0]}`, {
                                lang: 'en',
                              })
                            }
                            className="rounded-full px-1.5 py-1"
                            aria-label={`Озвучить ${v.base}`}
                          >
                            <IconSpeaker size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </Reveal>
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
const matches = answerMatches

function sampleRound(all: IrregularVerb[]): IrregularVerb[] {
  const pool = [...all]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    // i и j всегда валидные индексы pool (0..pool.length-1) — классический
    // Fisher-Yates, элементы под ними гарантированно есть.
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return pool.slice(0, ROUND_SIZE)
}

interface Result {
  verb: IrregularVerb
  ok: boolean
  /** Что ввёл ученик: «past / part» (для разбора «Посмотреть результаты»). */
  given: string
}

function Trainer({ groups }: { groups: IrregularGroup[] }) {
  // тренировать все глаголы, одну группу или «Мои ошибки» (при 147 полезно)
  const [scope, setScope] = useState<string>('all')
  // счётчик ошибок для пункта списка (обновляется при перерисовке)
  const [mistakeCount, setMistakeCount] = useState(() => getVerbMistakes('en').length)

  const verbsForScope = useCallback(
    (s: string): IrregularVerb[] => {
      if (s === 'mistakes') {
        const set = new Set(getVerbMistakes('en'))
        return groups.flatMap((g) => g.verbs).filter((v) => set.has(v.base))
      }
      const src = s === 'all' ? groups : groups.filter((g) => g.title === s)
      return src.flatMap((g) => g.verbs)
    },
    [groups],
  )
  const all = useMemo(() => verbsForScope(scope), [verbsForScope, scope])
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

  const next = () => {
    setIndex((i) => i + 1)
    setPast('')
    setPart('')
    setChecked(false)
  }

  const restart = (pool: IrregularVerb[] = all) => {
    setRound(sampleRound(pool))
    setIndex(0)
    setPast('')
    setPart('')
    setChecked(false)
    setResults([])
  }

  /** Смена набора начинает новый раунд из выбранной группы. */
  const pickScope = (next: string) => {
    if (next === scope) return
    setScope(next)
    restart(verbsForScope(next))
  }

  // выбор группы глаголов — выпадающим списком
  const scopeChips = (
    <label className="flex items-center gap-2 text-sm">
      <span className="shrink-0 text-[var(--night-text-40)]">Группа:</span>
      <select
        value={scope}
        onChange={(e) => pickScope(e.target.value)}
        className="min-h-11 flex-1 rounded-xl border border-white/[0.10] bg-[var(--night-input)] px-3 text-sm text-[var(--night-text)] outline-none focus:border-[var(--night-accent-45)]"
      >
        <option value="all">Все группы</option>
        {mistakeCount > 0 && <option value="mistakes">Мои ошибки ({mistakeCount})</option>}
        {groups.map((g) => (
          <option key={g.title} value={g.title}>
            {g.title}
          </option>
        ))}
      </select>
    </label>
  )

  // done === (index >= round.length) === (verb === undefined) — эквивалентны
  // по построению; !verb добавлен явно для noUncheckedIndexedAccess.
  if (done || !verb) {
    const correct = results.filter((r) => r.ok).length
    const wrong = results.filter((r) => !r.ok)
    return (
      <div className="flex flex-col gap-3">
        {scopeChips}
        <RoundResult
          correct={correct}
          total={round.length}
          note="Раунд засчитан в серию дня."
          lang="en"
          review={results.map((r) => ({
            prompt: `${r.verb.base} (${r.verb.ru})`,
            given: r.given,
            correct: `${r.verb.past} / ${r.verb.part}`,
            ok: r.ok,
          }))}
          onRestart={() => restart()}
        >
          {wrong.length > 0 && (
            <div className="rounded-xl bg-[var(--night-surface)] p-3 text-left text-sm">
              <p className="mb-1 font-semibold">Повтори:</p>
              {wrong.map(({ verb: v }) => (
                <p key={v.base}>
                  {v.base} — {v.past} — {v.part}{' '}
                  <span className="text-[var(--night-text-40)]">({v.ru})</span>
                </p>
              ))}
            </div>
          )}
        </RoundResult>
      </div>
    )
  }

  const check = () => {
    if (checked) return
    setChecked(true)
    const ok = matches(past, verb.past) && matches(part, verb.part)
    setResults((r) => [...r, { verb, ok, given: `${past.trim()} / ${part.trim()}` }])
    // банк «Мои ошибки»: неверный глагол кладём, верный — убираем
    if (ok) removeVerbMistake('en', verb.base)
    else addVerbMistake('en', verb.base)
    setMistakeCount(getVerbMistakes('en').length)
    if (index + 1 >= round.length) void logActivity('grammar')
  }

  const pastOk = checked && matches(past, verb.past)
  const partOk = checked && matches(part, verb.part)
  const inputCls = (ok: boolean) =>
    `rounded-xl border px-4 py-2.5 ${
      !checked
        ? 'border-white/[0.10] bg-[var(--night-surface)]'
        : ok
          ? 'border-emerald-500 bg-emerald-950/40'
          : 'border-red-400 bg-red-950/40'
    }`

  return (
    <div className="flex flex-col gap-3">
      {scopeChips}
      <div className="flex items-center justify-between text-sm text-[var(--night-text-40)]">
        <span>
          Глагол {index + 1} / {round.length}
        </span>
        <span>верно: {results.filter((r) => r.ok).length}</span>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="text-center">
          <p className="text-2xl font-bold">{verb.base}</p>
          <p className="text-sm text-[var(--night-text-40)]">{verb.ru}</p>
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
            <p className="animate-answer-pop text-sm font-medium text-emerald-400">Верно!</p>
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
