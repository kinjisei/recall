// ============================================================================
// Просмотр слов набора + выборочное назначение (карточка ученицы у
// преподавателя). Раньше наборы назначались вслепую — не было видно, какие
// слова внутри. Теперь: раскрыл набор → видишь слова (поиск при длинном
// списке) → можно назначить ВЕСЬ набор кнопкой выше или отметить галочками
// часть → «Назначить выбранные» создаст колоду-выборку с копиями карточек
// (lib/teacher.assignSelectedWords) и назначит её ученице.
// ============================================================================
import { useCallback, useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { LoadError } from '../../components/LoadError'
import { useAsyncData } from '../../lib/useAsyncData'
import { listDeckCards, assignSelectedWords } from '../../lib/teacher'
import type { Card, Deck } from '../../types'

const SEARCH_FROM = 30 // поиск показываем только на длинных списках

export function DeckWordsPicker({
  deck,
  studentId,
  studentName,
  onAssigned,
}: {
  deck: Deck
  studentId: string
  studentName: string
  /** Дёргается после создания колоды-выборки (обновить список наборов). */
  onAssigned: () => void
}) {
  const load = useCallback(() => listDeckCards(deck.id), [deck.id])
  const { data: cards, error, loading, reload } = useAsyncData<Card[]>(
    load,
    [deck.id],
    'Не удалось загрузить слова',
  )

  const [query, setQuery] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [assignError, setAssignError] = useState<string | null>(null)

  const visible = useMemo(() => {
    const all = cards ?? []
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (c) =>
        c.front.toLowerCase().includes(q) || (c.back ?? '').toLowerCase().includes(q),
    )
  }, [cards, query])

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const assignSelected = async () => {
    const selected = (cards ?? []).filter((c) => checked.has(c.id))
    if (selected.length === 0) return
    setBusy(true)
    setAssignError(null)
    try {
      const added = await assignSelectedWords(deck, studentId, studentName, selected)
      setNotice(`Назначено слов: ${added} — набор-выборка появился у ученицы`)
      setChecked(new Set())
      onAssigned()
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : 'Не удалось назначить выборку')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="px-1 text-sm text-[var(--night-text-40)]">Загрузка слов…</p>
  if (error) return <LoadError message={error} onRetry={reload} />
  if ((cards ?? []).length === 0) {
    return <p className="px-1 text-sm text-[var(--night-text-40)]">В наборе пока нет слов.</p>
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] p-2.5">
      {(cards ?? []).length >= SEARCH_FROM && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по слову или переводу…"
          aria-label="Поиск по словам набора"
          className="w-full rounded-lg border border-white/[0.10] bg-[var(--night-input)] px-3 py-2 text-sm outline-none focus:border-[var(--night-accent-45)]"
        />
      )}

      <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
        {visible.map((c) => (
          <li key={c.id}>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.05]">
              <input
                type="checkbox"
                checked={checked.has(c.id)}
                onChange={() => toggle(c.id)}
                className="h-4 w-4 shrink-0 accent-[var(--night-accent)]"
              />
              <span className="min-w-0 text-sm">
                <span className="font-medium">{c.front}</span>
                {c.back && (
                  <span className="text-[var(--night-text-40)]"> · {c.back}</span>
                )}
              </span>
            </label>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-2 py-2 text-sm text-[var(--night-text-40)]">Ничего не найдено.</li>
        )}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="px-3 py-2 text-sm"
          disabled={checked.size === 0}
          loading={busy}
          onClick={assignSelected}
        >
          Назначить выбранные ({checked.size})
        </Button>
        {checked.size > 0 && (
          <Button
            variant="ghost"
            className="px-3 py-2 text-sm"
            onClick={() => setChecked(new Set())}
          >
            Снять отметки
          </Button>
        )}
        <span className="text-xs text-[var(--night-text-40)]">
          всего слов: {(cards ?? []).length}
        </span>
      </div>
      {notice && <p className="text-sm text-emerald-400">{notice}</p>}
      {assignError && <p className="text-sm text-red-400">{assignError}</p>}
    </div>
  )
}
