// ============================================================================
// Шторка «Новый ученик» и «Изменить данные» (макет t6-3): имя, телефон или ник
// в Telegram, статус (только у нового: «пробный / занимается»), заметка.
// Набранное — черновиком (Ф1.14): новая версия приложения перезагружает
// страницу, а заметка бывает длинной.
// ============================================================================
import { useState, type FormEvent } from 'react'
import { createStudentCard, updateStudentCard, type StudentCard } from '../../domains/students'
import { useDraftForm } from '../../shared/lib/useDraft'
import { Button } from '../../shared/ui/Button'
import { ChoiceGroup } from '../../shared/ui/ChoiceGroup'
import { DraftRestored } from '../../shared/ui/DraftRestored'
import { IconClose } from '../../shared/ui/icons'
import { Sheet } from '../../shared/ui/Sheet'

const inputCls =
  'mt-1.5 h-12 w-full rounded-xl border border-tint/[0.10] bg-input px-3.5 text-base outline-none focus:border-accent-line'

type NewStatus = 'trial' | 'active'
const STATUS_OPTIONS: { id: NewStatus; label: string }[] = [
  { id: 'trial', label: 'Пробный' },
  { id: 'active', label: 'Занимается' },
]

export function CardForm({
  card,
  onClose,
  onSaved,
}: {
  /** null — новый ученик. */
  card: StudentCard | null
  onClose: () => void
  /** Сохранено: id карточки (новой или изменённой). */
  onSaved: (id: string) => void
}) {
  const [form, field, draft] = useDraftForm(card ? `student-card:${card.id}` : 'student-card:new', {
    name: card?.name ?? '',
    contact: card?.contact ?? '',
    note: card?.note ?? '',
    status: 'trial' as NewStatus,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const title = card ? 'Изменить данные' : 'Новый ученик'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const input = { name: form.name, contact: form.contact, note: form.note }
      const id = card ? card.id : await createStudentCard({ ...input, status: form.status })
      if (card) await updateStudentCard(card.id, input)
      draft.forget()
      onSaved(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={onClose} maxH="88dvh" labelledBy="card-form-title">
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 px-5 pt-1">
          <h2 id="card-form-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-2 flex size-11 flex-none items-center justify-center rounded-full text-fg-muted"
          >
            <IconClose size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {draft.restored && <DraftRestored onClear={draft.clear} className="mb-3" />}
          <label className="block text-sm font-medium">
            Имя
            <input
              value={form.name}
              onChange={(e) => field('name')(e.target.value)}
              placeholder="Имя и фамилия"
              maxLength={80}
              autoFocus={!card}
              autoComplete="off"
              className={inputCls}
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Телефон или ник в Telegram
            <input
              value={form.contact}
              onChange={(e) => field('contact')(e.target.value)}
              placeholder="+7 700 000 00 00 или @ник"
              maxLength={80}
              autoComplete="off"
              className={inputCls}
            />
          </label>
          {!card && (
            <div className="mt-4">
              <p className="text-sm font-medium">Статус</p>
              <ChoiceGroup
                options={STATUS_OPTIONS}
                value={form.status}
                onChange={(v) => field('status')(v)}
                label="Статус ученика"
                stretch
                className="mt-1.5"
              />
            </div>
          )}
          <label className="mt-4 block text-sm font-medium">
            Заметка
            <textarea
              value={form.note}
              onChange={(e) => field('note')(e.target.value)}
              placeholder="Например: готовится к IELTS, цель — 7.0"
              maxLength={1000}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-xl border border-tint/[0.10] bg-input px-3.5 py-2.5 text-base outline-none focus:border-accent-line"
            />
          </label>
          {!card && (
            <p className="mt-3 text-xs text-fg-muted">
              Место в тарифе ученик займёт, только когда войдёт в приложение — и если он не
              пробный.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger-soft-fg">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-tint/[0.06] px-5 py-3">
          <Button type="submit" className="w-full py-3" disabled={!form.name.trim()} loading={busy}>
            {card ? 'Сохранить' : 'Добавить'}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
