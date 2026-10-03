// ============================================================================
// Сборка домашки переживает перезагрузку, пока не выдана (PLAN.md Ф1.14):
// срок, пункты (названия учитель печатает сам, подбор AI тратит генерацию) и
// записка — одним черновиком на ученика (shared/lib/useDraft).
// ============================================================================
import { useDraftForm } from '../../shared/lib/useDraft'
import type { SuggestedItem } from '../../lib/homeworkSuggest'

/** Черновик сборки домашки ученика — по нему и кнопка: «Продолжить сборку». */
export const composerDraft = (studentId: string) => `homework:${studentId}`

export function useComposerDraft(studentId: string, due: string, items: SuggestedItem[]) {
  const [form, field, draft] = useDraftForm(composerDraft(studentId), { due, note: '', items })
  return { ...form, setDue: field('due'), setNote: field('note'), setItems: field('items'), draft }
}
