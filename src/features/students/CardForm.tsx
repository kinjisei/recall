// ============================================================================
// Шторка «Новый ученик» и «Изменить данные» (макет t6-3): имя, телефон или ник
// в Telegram, статус (только у нового: «пробный / занимается»), заметка.
// Набранное — черновиком (Ф1.14): новая версия приложения перезагружает
// страницу, а заметка бывает длинной.
//
// У нового ученика внизу — «Пригласить по общему коду» (Ф2.11б-2): та же
// шторка показывает общий код с сообщением (GeneralInvite), «‹» — обратно к
// форме, набранное в ней не теряется.
// ============================================================================
import { useState, type FormEvent, type ReactNode } from 'react'
import { createStudentCard, updateStudentCard, type SavedCard, type StudentCard } from '../../domains/students'
import { useDraftForm } from '../../shared/lib/useDraft'
import { Button } from '../../shared/ui/Button'
import { ChoiceGroup } from '../../shared/ui/ChoiceGroup'
import { DraftRestored } from '../../shared/ui/DraftRestored'
import { IconBack, IconChevronRight } from '../../shared/ui/icons'
import { Sheet } from '../../shared/ui/Sheet'
import { SheetHeader } from '../../shared/ui/SheetHeader'
import { ErrorText } from '../../shared/ui/ErrorText'
import { fieldClass } from '../../shared/ui/TextField'

const inputCls = `${fieldClass()} mt-1.5`

type NewStatus = 'trial' | 'active'
const STATUS_OPTIONS: { id: NewStatus; label: string }[] = [
  { id: 'trial', label: 'Пробный' },
  { id: 'active', label: 'Занимается' },
]

export function CardForm({
  card,
  generalInvite,
  onClose,
  onSaved,
}: {
  /** null — новый ученик. */
  card: StudentCard | null
  /** Общий код (GeneralInvite) — второй экран шторки нового ученика. */
  generalInvite?: ReactNode
  onClose: () => void
  /** Сохранено: id карточки (новой или изменённой) и что сохранили — список ещё не перечитан. */
  onSaved: (id: string, saved: SavedCard) => void
}) {
  const [form, field, draft] = useDraftForm(card ? `student-card:${card.id}` : 'student-card:new', {
    name: card?.name ?? '',
    contact: card?.contact ?? '',
    note: card?.note ?? '',
    status: 'trial' as NewStatus,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [general, setGeneral] = useState(false)
  const title = card ? 'Изменить данные' : general ? 'Общий код' : 'Новый ученик'

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
      onSaved(id, { name: form.name, contact: form.contact || null, status: card ? card.status : form.status })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={onClose} maxH="88dvh" labelledBy="card-form-title">
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <SheetHeader
          id="card-form-title"
          title={title}
          lead={
            general && (
              <button
                type="button"
                onClick={() => setGeneral(false)}
                aria-label="К новому ученику"
                className="-ml-3 flex size-11 flex-none items-center justify-center rounded-full text-accent-strong"
              >
                <IconBack size={20} />
              </button>
            )
          }
        />

        {general ? (
          <div className="flex-1 overflow-y-auto px-5 py-4">{generalInvite}</div>
        ) : (
          <>
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
                  className={`${fieldClass()} mt-1.5 resize-none py-3`}
                />
              </label>
              {!card && (
                <p className="mt-3 text-xs text-fg-muted">
                  Место в тарифе ученик займёт, только когда войдёт в приложение — и если он не
                  пробный.
                </p>
              )}
              {error && (
                <ErrorText className="mt-3">
                  {error}
                </ErrorText>
              )}
              {!card && generalInvite && (
                <button
                  type="button"
                  onClick={() => setGeneral(true)}
                  className="mt-4 flex min-h-12 w-full items-center gap-3 rounded-control border border-tint/[0.08] px-3.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">Пригласить по общему коду</span>
                    <span className="block text-xs text-fg-muted">один код на всех — ученик сам появится в списке</span>
                  </span>
                  <IconChevronRight size={18} className="flex-none text-fg-muted" />
                </button>
              )}
            </div>

            <div className="border-t border-tint/[0.06] px-5 py-3">
              <Button type="submit" className="w-full" disabled={!form.name.trim()} loading={busy}>
                {card ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </>
        )}
      </form>
    </Sheet>
  )
}
