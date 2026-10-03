// ============================================================================
// Поле, которое переживает перезагрузку (PLAN.md Ф1.14): набранное
// сохраняется на устройстве и возвращается при новом открытии экрана, пока
// не отправлено (не дольше 7 дней). Правила и хранение — shared/lib/drafts.
//
//   const [essay, setEssay, draft] = useDraft(`writing:${task.id}`, '')
//   …{draft.restored && <DraftRestored onClear={draft.clear} />}
//   отправили — draft.forget()
//
// scope — что за черновик: экран + задание, уникально у одного человека.
// null — не сохранять (задание ещё не выбрано). Значение — любая JSON-форма:
// строка, ответы упражнений, комментарии по пунктам.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { clearDraft, readDraft, writeDraft } from './drafts'

export interface DraftControls {
  /** Значение пришло из черновика — показать «Черновик восстановлен». */
  restored: boolean
  /** «Очистить»: стереть черновик и вернуть поле к пустому. */
  clear: () => void
  /** Отправлено: черновик больше не нужен, а текст на экране остаётся. */
  forget: () => void
}

interface State<T> {
  scope: string | null
  value: T
  restored: boolean
  /** Правка человека — её и пишем; загрузка черновика срок жизни не продлевает. */
  dirty: boolean
}

function load<T>(scope: string | null, empty: T): State<T> {
  const saved = scope ? readDraft<T>(scope) : null
  return saved === null
    ? { scope, value: empty, restored: false, dirty: false }
    : { scope, value: saved, restored: true, dirty: false }
}

export function useDraft<T>(
  scope: string | null,
  empty: T,
): [T, (next: T | ((prev: T) => T)) => void, DraftControls] {
  const [state, setState] = useState(() => load(scope, empty))
  // Другое задание (scope сменился без перемонтирования) — его черновик.
  // Обновление во время отрисовки — штатный приём React для такого случая.
  let current = state
  if (state.scope !== scope) {
    current = load(scope, empty)
    setState(current)
  }

  useEffect(() => {
    if (current.dirty && current.scope) writeDraft(current.scope, current.value)
  }, [current])

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setState((s) => ({
      ...s,
      value: typeof next === 'function' ? (next as (prev: T) => T)(s.value) : next,
      dirty: true,
    }))
  }, [])

  const draftScope = current.scope
  const clear = useCallback(() => {
    if (draftScope) clearDraft(draftScope)
    setState((s) => ({ ...s, value: empty, restored: false, dirty: false }))
    // empty — значение по умолчанию экрана, оно не меняется между отрисовками
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftScope])

  const forget = useCallback(() => {
    if (draftScope) clearDraft(draftScope)
    setState((s) => ({ ...s, restored: false, dirty: false }))
  }, [draftScope])

  return [current.value, set, { restored: current.restored, clear, forget }]
}

/**
 * Форма из нескольких полей одним черновиком: field('topic') — сеттер одного
 * поля (значение или функция от прежнего, как у useState).
 */
export function useDraftForm<F extends Record<string, unknown>>(scope: string | null, empty: F) {
  const [form, setForm, draft] = useDraft(scope, empty)
  const field =
    <K extends keyof F>(key: K) =>
    (next: F[K] | ((prev: F[K]) => F[K])) =>
      setForm((f) => ({ ...f, [key]: typeof next === 'function' ? (next as (prev: F[K]) => F[K])(f[key]) : next }))
  return [form, field, draft] as const
}
