// ============================================================================
// Черновик формы программы (Ф1.14): набранное и уже составленная AI
// программа переживают перезагрузку — генерация стоит энергии.
//
// С 4г-1 (макет d11-2) язык выбирается в самой форме, поэтому черновик один
// на ученика, а язык — его поле. До этого черновик жил по языку
// (`program:<id>:en|es`) — такой подхватываем один раз: переносим под новый
// ключ и стираем старый, иначе раздел вечно открывался бы формой.
// ============================================================================
import { clearDraft, readDraft, writeDraft } from '../../../shared/lib/drafts'
import type { GeneratedPlan } from '../../../lib/studyPlan'
import type { AppLang } from '../../../types'

export type ProgramForm = {
  lang: AppLang
  level: string
  weeks: number
  goal: string
  /** Черновик AI — ещё не назначен, ученик его не видит. */
  preview: GeneratedPlan | null
  /** «К форме» из черновика: смотрим форму, черновик ждёт. */
  editing: boolean
}

export const programDraftKey = (studentId: string): string => `program:${studentId}`
const legacyKey = (studentId: string, lang: AppLang): string => `program:${studentId}:${lang}`

type Legacy = Partial<Omit<ProgramForm, 'lang'>> & { feedback?: string }

/** Есть незаконченная программа — раздел открывается формой, а не сохранённой. */
export function hasProgramDraft(studentId: string): boolean {
  return (
    readDraft(programDraftKey(studentId)) !== null ||
    readDraft(legacyKey(studentId, 'en')) !== null ||
    readDraft(legacyKey(studentId, 'es')) !== null
  )
}

/**
 * Значения формы, если своего черновика нет: старый черновик по языку
 * (переносится под новый ключ — тогда форма его и поднимет) или base.
 * Правки к черновику («Правки», до 4г-1) уходят в цель: AI получал их так же.
 */
export function initialProgramForm(studentId: string, base: Omit<ProgramForm, 'preview' | 'editing'>): ProgramForm {
  const fresh: ProgramForm = { ...base, preview: null, editing: false }
  if (readDraft(programDraftKey(studentId)) !== null) return fresh
  for (const lang of ['en', 'es'] as const) {
    const old = readDraft<Legacy>(legacyKey(studentId, lang))
    if (!old) continue
    const { feedback, ...rest } = old
    const goal = [rest.goal, feedback].map((s) => String(s ?? '').trim()).filter(Boolean).join('. ')
    writeDraft(programDraftKey(studentId), { ...fresh, ...rest, goal, lang })
    clearDraft(legacyKey(studentId, lang))
    return fresh
  }
  return fresh
}
