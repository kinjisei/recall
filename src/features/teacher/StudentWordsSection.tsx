// ============================================================================
// «Слова» ученицы у преподавателя: список слов со статусом изученности,
// выбор галочками → назначить перепроверку; результаты прошлых перепроверок.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { LoadError } from '../../components/LoadError'
import {
  assignWordCheck,
  getStudentWords,
  getWordChecks,
  type StudentWord,
} from '../../lib/wordChecks'
import type { WordCheck } from '../../types'

const statusChip = {
  new: { label: 'новое', cls: 'bg-white/[0.06] text-[var(--night-text-40)] dark:bg-white/[0.08] dark:text-[var(--night-text-25)]' },
  learning: { label: 'учится', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' },
  learned: { label: 'изучено', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
} as const

export function StudentWordsSection({ studentId }: { studentId: string }) {
  const [words, setWords] = useState<StudentWord[] | null>(null)
  const [checks, setChecks] = useState<WordCheck[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openCheck, setOpenCheck] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // «Слов: 0» при сбое вводило преподавателя в заблуждение — теперь ошибка видна
  const reload = useCallback(() => {
    setLoadError(null)
    getStudentWords(studentId)
      .then(setWords)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить слова'))
    getWordChecks(studentId)
      .then(setChecks)
      .catch(() => setChecks([]))
  }, [studentId])

  useEffect(() => {
    reload()
  }, [reload])

  const toggle = (cardId: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })

  const assign = async () => {
    if (selected.size === 0 || busy) return
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      await assignWordCheck(studentId, [...selected])
      setMsg(`Перепроверка назначена: слов — ${selected.size} ✓`)
      setSelected(new Set())
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось назначить')
    } finally {
      setBusy(false)
    }
  }

  // ошибка загрузки — отдельно от «слов нет»: иначе преподаватель видел бы
  // пустой список у ученицы, у которой слова есть
  if (loadError) return <LoadError message={loadError} onRetry={reload} />
  if (words === null) return <p className="text-sm text-[var(--night-text-40)]">Загружаю слова…</p>

  return (
    <div className="flex flex-col gap-2">
      {/* Прошлые перепроверки */}
      {checks.length > 0 && (
        <div className="flex flex-col gap-1">
          {checks.map((c) => {
            const okCount = (c.results ?? []).filter((r) => r.ok).length
            const wrong = (c.results ?? []).filter((r) => !r.ok)
            const date = new Date(c.created_at).toLocaleDateString('ru-RU')
            return (
              <div key={c.id} className="rounded-lg bg-white/[0.06] px-3 py-2 text-sm dark:bg-[var(--night-surface)]">
                {c.completed_at ? (
                  <>
                    <button
                      onClick={() => setOpenCheck((cur) => (cur === c.id ? null : c.id))}
                      className="w-full text-left"
                    >
                      {date}:{' '}
                      <span className="font-semibold">
                        {okCount}/{c.card_ids.length}
                      </span>
                      {wrong.length > 0 && (
                        <span className="text-[var(--night-text-40)]"> · показать провалы {openCheck === c.id ? '▾' : '▸'}</span>
                      )}
                    </button>
                    {openCheck === c.id &&
                      wrong.map((r) => (
                        <p key={r.card_id} className="mt-1 pl-4 text-xs text-[var(--night-text-40)]">
                          «{r.given || '—'}» →{' '}
                          <span className="font-semibold text-[var(--night-text-70)]">
                            {r.front}
                          </span>
                          {r.back && ` (${r.back})`}
                        </p>
                      ))}
                  </>
                ) : (
                  <span className="text-[var(--night-text-40)]">
                    {date}: назначена, ещё не пройдена ({c.card_ids.length} слов)
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {words.length === 0 ? (
        <p className="text-sm text-[var(--night-text-40)]">У ученицы пока нет своих слов.</p>
      ) : (
        <>
          <p className="text-xs text-[var(--night-text-40)]">
            Отметь слова для перепроверки (сверху — с самым большим интервалом):
          </p>
          <div className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
            {words.map((w) => {
              const chip = statusChip[w.status]
              return (
                <label
                  key={w.card.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] px-2.5 py-1.5 dark:border-white/[0.08]"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(w.card.id)}
                    onChange={() => toggle(w.card.id)}
                    className="h-4 w-4 accent-sky-600"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">{w.card.front}</span>
                    {w.card.back && <span className="text-[var(--night-text-40)]"> — {w.card.back}</span>}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip.cls}`}>
                    {chip.label}
                    {w.intervalDays > 0 ? ` ${w.intervalDays}д` : ''}
                  </span>
                </label>
              )
            })}
          </div>
          <Button
            className="mt-1"
            onClick={assign}
            disabled={busy || selected.size === 0}
          >
            {busy ? 'Назначаю…' : `Назначить перепроверку (${selected.size})`}
          </Button>
        </>
      )}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
