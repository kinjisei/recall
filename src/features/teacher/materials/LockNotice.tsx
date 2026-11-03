// ============================================================================
// Плашка замка (макет d17-4 `.lk17`, PLAN.md Ф2.25-3б): материал уже сдали —
// «Работу уже сдали: Әсел — правка изменила бы её проверку», «✎ Сделать
// копию и править» и «копия — новый черновик без учеников, у них ничего не
// изменится». Копия — новый материал с тем же заголовком (журнал п.76 (21)),
// открывается сразу и правится; правка, которую база не приняла (сдали во
// время правки), переезжает в копию открытой формой.
// ============================================================================
import { useState } from 'react'
import { copyMaterial, lockText } from '../../../domains/materials'
import { clearDraft, readDraft, writeDraft } from '../../../shared/lib/drafts'
import { ErrorText } from '../../../shared/ui/ErrorText'
import { IconLock, IconPencil } from '../../../shared/ui/icons'
import type { Material } from '../../../types'
import { libraryEditScope } from './LibraryExercises'

export function LockNotice({
  material,
  names,
  onlyPast,
  raced,
  onCopied,
}: {
  material: Material
  /** Чьи работы закрывают правку. */
  names: string[]
  /** Все — только в истории (переназначены). */
  onlyPast: boolean
  /** Работу сдали во время правки — она не сохранилась. */
  raced: boolean
  onCopied: (copy: Material) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const from = libraryEditScope(material.id)
  const pending = raced && readDraft(from) !== null

  const copy = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const id = await copyMaterial(material.id)
      // открытая правка — в копию: упражнения у неё те же, форма узнает своё
      const draft = readDraft(from)
      if (draft !== null) writeDraft(libraryEditScope(id), draft)
      clearDraft(from)
      onCopied({ ...material, id, created_at: new Date().toISOString(), exercises_version: 1 })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сделать копию')
      setBusy(false)
    }
  }

  return (
    <div role="status" className="flex flex-col gap-2.5 rounded-control bg-warning-soft px-4 py-3.5" data-material-lock>
      <p className="flex gap-2 text-body leading-normal text-fg">
        <IconLock size={16} aria-hidden className="mt-1 flex-none text-warning-strong" />
        <span>
          {lockText(names, onlyPast)}
          {raced && (pending ? '. Твоя правка не сохранилась — она откроется в копии.' : '. Правка не сохранилась.')}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <button
          type="button"
          onClick={() => void copy()}
          disabled={busy}
          aria-busy={busy}
          className="inline-flex h-11 flex-none items-center gap-1.5 whitespace-nowrap rounded-tile bg-surface px-4 text-body font-semibold text-fg inset-ring-1 inset-ring-line active:bg-ghost-press disabled:opacity-60"
        >
          <IconPencil size={16} aria-hidden /> Сделать копию и править
        </button>
        {/* справа от кнопки, как в кадре; узко (телефон) — строкой ниже */}
        <small className="min-w-48 flex-1 text-note text-fg-secondary">копия — новый черновик без учеников, у них ничего не изменится</small>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  )
}
