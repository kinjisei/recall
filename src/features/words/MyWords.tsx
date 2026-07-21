// ============================================================================
// «Мои слова» — то, чего в приложении не было: список собственных карточек
// с поиском, фильтром по статусу, правкой и удалением.
//
// Раньше добавленное по ошибке слово оставалось в колоде навсегда и всплывало
// на повторениях; теперь его можно исправить или удалить (расписание уходит
// каскадом, см. lib/cards.ts).
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconSearch,
  IconPencil,
  IconSpeaker,
  IconCheck,
  IconTrash,
  IconClose,
  IconTray,
} from '../../components/icons'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { deleteCard, listMyWords, updateCard, type MyWord } from '../../lib/cards'
import { speak } from '../../lib/speech'
import type { WordStatus } from '../../lib/wordChecks'
import { GameHeader } from './GameShell'
import type { AppLang } from '../../types'

type Filter = 'all' | WordStatus

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'new', label: 'Новые' },
  { id: 'learning', label: 'Учу' },
  { id: 'learned', label: 'Выучено' },
]

const STATUS_CHIP: Record<WordStatus, { label: string; cls: string }> = {
  new: { label: 'новое', cls: 'bg-white/[0.08] text-[var(--night-text-40)]' },
  learning: {
    label: 'учу',
    cls: 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]',
  },
  learned: { label: 'выучено', cls: 'bg-emerald-500/20 text-emerald-300' },
}

export function MyWords({ lang, onBack }: { lang: AppLang; onBack: () => void }) {
  const [words, setWords] = useState<MyWord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // useRef, чтобы перезагрузка после правки/удаления не спорила с эффектом
  const reloadRef = useRef<() => void>(() => {})

  useEffect(() => {
    // alive: ответ по прежнему языку не должен перетереть новый список
    let alive = true
    const run = () => {
      setWords(null)
      setError(null)
      listMyWords(lang)
        .then((w) => alive && setWords(w))
        .catch(
          (e) =>
            alive &&
            setError(e instanceof Error ? e.message : 'Не удалось загрузить слова'),
        )
    }
    reloadRef.current = run
    run()
    return () => {
      alive = false
    }
  }, [lang])

  const shown = useMemo(() => {
    if (!words) return []
    const q = query.trim().toLowerCase()
    return words.filter((w) => {
      if (filter !== 'all' && w.status !== filter) return false
      if (!q) return true
      return (
        w.card.front.toLowerCase().includes(q) ||
        (w.card.back ?? '').toLowerCase().includes(q) ||
        (w.card.example ?? '').toLowerCase().includes(q)
      )
    })
  }, [words, query, filter])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, new: 0, learning: 0, learned: 0 }
    for (const w of words ?? []) {
      c.all++
      c[w.status]++
    }
    return c
  }, [words])

  const onDelete = async (id: string) => {
    try {
      await deleteCard(id)
      setWords((ws) => (ws ?? []).filter((w) => w.card.id !== id))
      setConfirmDelete(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить слово')
    }
  }

  const onSave = async (
    id: string,
    fields: { front: string; back: string; example: string },
  ) => {
    try {
      await updateCard(id, fields)
      setWords((ws) =>
        (ws ?? []).map((w) =>
          w.card.id === id
            ? {
                ...w,
                card: {
                  ...w.card,
                  front: fields.front.trim(),
                  back: fields.back.trim() || null,
                  example: fields.example.trim() || null,
                },
              }
            : w,
        ),
      )
      setEditing(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <GameHeader title="Мои слова" onBack={onBack} />

      {error && (
        <Card className="border-red-400/40 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      {/* поиск */}
      <div className="relative">
        <IconSearch
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--night-text-40)]"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти слово или перевод…"
          className="h-11 w-full rounded-xl border border-white/[0.10] bg-[var(--night-input)] pl-10 pr-3 text-sm outline-none focus:border-[var(--night-accent-45)]"
        />
      </div>

      {/* фильтры по статусу */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 min-h-[44px] rounded-full px-4 text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                : 'bg-white/[0.06] text-[var(--night-text-40)]'
            }`}
          >
            {f.label}
            {words && <span className="ml-1 opacity-60">{counts[f.id]}</span>}
          </button>
        ))}
      </div>

      {!words ? (
        <p className="text-[var(--night-text-40)]">Загрузка…</p>
      ) : shown.length === 0 ? (
        <Card className="text-center">
          <IconTray size={38} className="mx-auto block text-[var(--night-text-40)]" />
          <p className="mt-2 font-medium">
            {counts.all === 0 ? 'Пока нет своих слов' : 'Ничего не найдено'}
          </p>
          <p className="mt-1 text-sm text-[var(--night-text-40)]">
            {counts.all === 0
              ? 'Добавляй слова тапом в разделе «Учёба» или кнопкой «Паки» в повторении.'
              : 'Попробуй другой запрос или фильтр.'}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((w) => (
            <WordRow
              key={w.card.id}
              word={w}
              lang={lang}
              editing={editing === w.card.id}
              confirming={confirmDelete === w.card.id}
              onEdit={() => {
                setEditing(w.card.id)
                setConfirmDelete(null)
              }}
              onCancelEdit={() => setEditing(null)}
              onSave={(f) => onSave(w.card.id, f)}
              onAskDelete={() => {
                setConfirmDelete(w.card.id)
                setEditing(null)
              }}
              onCancelDelete={() => setConfirmDelete(null)}
              onDelete={() => onDelete(w.card.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function WordRow({
  word,
  lang,
  editing,
  confirming,
  onEdit,
  onCancelEdit,
  onSave,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  word: MyWord
  lang: AppLang
  editing: boolean
  confirming: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onSave: (f: { front: string; back: string; example: string }) => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}) {
  const { card, status, intervalDays } = word
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back ?? '')
  const [example, setExample] = useState(card.example ?? '')

  // при открытии редактора подставляем актуальные значения
  useEffect(() => {
    if (editing) {
      setFront(card.front)
      setBack(card.back ?? '')
      setExample(card.example ?? '')
    }
  }, [editing, card])

  const chip = STATUS_CHIP[status]
  const inputCls =
    'w-full rounded-lg border border-white/[0.10] bg-[var(--night-input)] px-3 py-2 text-sm outline-none focus:border-[var(--night-accent-45)]'

  if (editing) {
    return (
      <Card className="flex flex-col gap-2 p-4">
        <input className={inputCls} value={front} onChange={(e) => setFront(e.target.value)} placeholder="Слово" />
        <input className={inputCls} value={back} onChange={(e) => setBack(e.target.value)} placeholder="Перевод" />
        <input
          className={inputCls}
          value={example}
          onChange={(e) => setExample(e.target.value)}
          placeholder="Пример (необязательно)"
        />
        <div className="mt-1 flex gap-2">
          <Button className="flex-1 py-2 text-sm" onClick={() => onSave({ front, back, example })} disabled={!front.trim()}>
            <IconCheck size={16} /> Сохранить
          </Button>
          <Button variant="ghost" className="py-2 text-sm" onClick={onCancelEdit}>
            Отмена
          </Button>
        </div>
      </Card>
    )
  }

  if (confirming) {
    return (
      <Card className="flex items-center justify-between gap-3 border-red-400/40 bg-red-500/10 p-4">
        <p className="min-w-0 text-sm">
          Удалить «{card.front}»? <span className="text-[var(--night-text-40)]">Отменить нельзя.</span>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onDelete}
            className="rounded-lg bg-red-500/90 px-3 py-1.5 text-sm font-medium text-white"
          >
            Удалить
          </button>
          <button
            onClick={onCancelDelete}
            aria-label="Отмена"
            className="rounded-lg border border-white/[0.10] px-2 py-1.5 text-[var(--night-text-70)]"
          >
            <IconClose size={16} />
          </button>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-medium">{card.front}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${chip.cls}`}>
            {chip.label}
            {intervalDays > 0 ? ` · ${intervalDays}д` : ''}
          </span>
        </div>
        {card.back && (
          <p className="truncate text-[13px] text-[var(--night-text-40)]">{card.back}</p>
        )}
      </div>

      <div className="flex shrink-0 gap-1">
        <button
          onClick={() => speak(card.front, { lang })}
          aria-label="Озвучить"
          className="rounded-lg p-2 text-[var(--night-text-40)] hover:text-[var(--night-text)]"
        >
          <IconSpeaker size={17} />
        </button>
        <button
          onClick={onEdit}
          aria-label={`Изменить ${card.front}`}
          className="rounded-lg p-2 text-[var(--night-text-40)] hover:text-[var(--night-text)]"
        >
          <IconPencil size={17} />
        </button>
        <button
          onClick={onAskDelete}
          aria-label={`Удалить ${card.front}`}
          className="rounded-lg p-2 text-[var(--night-text-40)] hover:text-red-400"
        >
          <IconTrash size={17} />
        </button>
      </div>
    </div>
  )
}
