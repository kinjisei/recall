// ============================================================================
// Правки учителя к разбору работы переживают перезагрузку, пока проверка не
// сохранена (PLAN.md Ф1.14). Черновик — только ПРАВКИ (отметки и комментарии
// по пунктам) и записка к повторной выдаче, а не весь разбор: разбор AI и так
// лежит на сервере, и без правок черновика нет — «Черновик восстановлен» не
// появится у работы, которую учитель не трогал.
// ============================================================================
import { useDraftForm } from '../../shared/lib/useDraft'
import type { ReviewItem } from '../../types'

export function useReviewDraft(assignmentId: string, base: ReviewItem[] | null) {
  const [form, field, draft] = useDraftForm(`review:${assignmentId}`, {
    edits: {} as Record<number, Partial<ReviewItem>>,
    note: '',
  })
  // разбор, который видит учитель: основа (AI или сохранённая проверка) + его правки
  const review = base && base.map((r) => ({ ...r, ...form.edits[r.index] }))
  const setItem = (index: number, patch: Partial<ReviewItem>) =>
    field('edits')((e) => ({ ...e, [index]: { ...e[index], ...patch } }))
  return { review, setItem, note: form.note, setNote: field('note'), draft }
}
