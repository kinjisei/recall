// ============================================================================
// Кто на уроке (макеты t3-1 … t3-3): ученик — одна карточка («Сменить»),
// группа — название и участники (поиск, снять ×). «Новый ученик» — прямо в
// шторке: имя и телефон / ник, карточка создаётся сразу (пробный — для
// пробного урока). Пауза и архив в урок не берутся — их отклонит и база.
// ============================================================================
import { useState } from 'react'
import { createStudentCard, matchesQuery, type StudentCard } from '../../domains/students'
import type { LessonKind } from '../../domains/schedule'
import { Avatar } from '../students'
import { Button } from '../../shared/ui/Button'
import { IconClose, IconPlus, IconSearch } from '../../shared/ui/icons'

const input = 'min-h-12 w-full rounded-xl bg-input px-3.5 text-base ring-1 ring-control-line outline-none focus:ring-2 focus:ring-accent-line'
const SHOWN = 6

function NewStudent({ kind, onCreated, onCancel }: { kind: LessonKind; onCreated: (card: StudentCard) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const add = async () => {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    const status = kind === 'trial' ? 'trial' : 'active'
    try {
      const id = await createStudentCard({ name, contact, note: '', status })
      const now = new Date().toISOString()
      onCreated({ id, userId: null, name: name.trim(), contact: contact.trim() || null, note: null, status, createdAt: now, updatedAt: now, inApp: false, linkedAt: null, seat: false, holdsSeat: false })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить ученика')
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-tint/[0.08] p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Новый ученик</span>
        <button type="button" onClick={onCancel} className="min-h-11 px-2 text-sm font-semibold text-accent-strong">
          Выбрать из списка
        </button>
      </div>
      <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя и фамилия" aria-label="Имя ученика" maxLength={80} />
      <input className={input} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Телефон или ник в Telegram" aria-label="Телефон или ник в Telegram" maxLength={80} />
      {error && <p role="alert" className="text-sm text-danger-soft-fg">{error}</p>}
      <Button variant="secondary" className="min-h-11 py-2 text-sm" disabled={!name.trim()} loading={busy} onClick={() => void add()}>
        Добавить ученика
      </Button>
    </div>
  )
}

export function FormWho({
  kind,
  cards,
  cardIds,
  title,
  locked = false,
  onCards,
  onTitle,
  onCreated,
}: {
  kind: LessonKind
  /** Карточки, которых можно позвать на урок. */
  cards: StudentCard[]
  cardIds: string[]
  title: string
  /** Состав не меняется (перенос одного урока серии — он в «Изменить»). */
  locked?: boolean
  onCards: (ids: string[]) => void
  onTitle: (title: string) => void
  onCreated: (card: StudentCard) => void
}) {
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(cards.length === 0)
  const group = kind === 'group'
  const byId = new Map(cards.map((c) => [c.id, c]))
  const chosen = cardIds.map((id) => byId.get(id)).filter((c): c is StudentCard => !!c)
  const pool = cards.filter((c) => (c.status === 'active' || c.status === 'trial') && !cardIds.includes(c.id))
  const found = pool.filter((c) => matchesQuery(c, query))
  const shown = query || found.length <= SHOWN + 1 ? found : found.slice(0, SHOWN)
  const pick = (id: string) => {
    onCards(group ? [...cardIds, id] : [id])
    setQuery('')
  }
  const created = (card: StudentCard) => {
    onCreated(card)
    onCards(group ? [...cardIds, card.id] : [card.id])
    setAdding(false)
  }

  const single = !group ? chosen[0] : undefined
  if (single) {
    return (
      <div className="flex min-h-12 items-center gap-3 rounded-xl bg-input px-3 ring-1 ring-control-line">
        <Avatar name={single.name} inApp={single.inApp} small />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{single.name}</span>
        {!locked && (
          <button type="button" onClick={() => onCards([])} className="min-h-11 px-2 text-sm font-semibold text-accent-strong">
            Сменить
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {group && (
        <label className="flex flex-col gap-1.5">
          <span className="text-note text-fg-muted">Название группы</span>
          <input className={input} value={title} onChange={(e) => onTitle(e.target.value)} placeholder="Например, IELTS вечер" maxLength={80} />
        </label>
      )}
      {group && chosen.length > 0 && (
        <ul aria-label={`Участники · ${chosen.length}`} className="flex flex-wrap gap-1.5">
          {chosen.map((c) => (
            <li key={c.id} className="flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pl-3 text-sm font-medium text-accent-soft-fg">
              {c.name}
              {!locked && (
                <button type="button" aria-label={`Убрать ${c.name}`} onClick={() => onCards(cardIds.filter((x) => x !== c.id))} className="flex size-9 items-center justify-center rounded-full">
                  <IconClose size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!locked &&
        (adding ? (
          <NewStudent kind={kind} onCreated={created} onCancel={() => setAdding(false)} />
        ) : (
          <>
            {pool.length > SHOWN && (
              <label className="relative">
                <span className="sr-only">Найти ученика</span>
                <IconSearch size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
                <input className={`${input} pl-10`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти ученика" />
              </label>
            )}
            <ul className="flex flex-col">
              {shown.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => pick(c.id)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-tint/[0.04]">
                    <Avatar name={c.name} inApp={c.inApp} small />
                    <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                    {!c.inApp && <span className="text-caption text-fg-muted">без приложения</span>}
                  </button>
                </li>
              ))}
              {shown.length < found.length && <li className="px-2 py-1 text-note text-fg-muted">Ещё {found.length - shown.length} — найди поиском</li>}
              {query && !found.length && <li className="px-2 py-1 text-note text-fg-muted">Никого не нашли</li>}
            </ul>
            <button type="button" onClick={() => setAdding(true)} className="flex min-h-11 items-center gap-2 self-start rounded-xl px-2 text-sm font-semibold text-accent-strong">
              <IconPlus size={18} aria-hidden /> Новый ученик
            </button>
          </>
        ))}
    </div>
  )
}
