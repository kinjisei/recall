// ============================================================================
// Шаги мастера материала: заявка → план от AI → предпросмотр текста с
// упражнениями (MaterialsSection; «Мой текст» — заявка → предпросмотр).
// Здесь только переходы, без экранов, — их проверяет test-material-wizard.
//
// «Назад» не выбрасывает готовое (PLAN.md Ф2.11). План и текст уже стоили
// генерации AI, а раньше «К плану» стирал текст, «К форме» — план, и вернуть
// их можно было только новой генерацией. Теперь шаги живут как история
// браузера: «назад» и «вперёд» двигают указатель, готовое впереди остаётся.
// Новый результат на следующем шаге (новый план из формы, новый текст из
// плана) отрезает то, что было дальше: это уже другая ветка. Пересоставить
// план или перегенерировать текст — правка того же шага: готовое впереди
// остаётся (текст хранит свой план, сохраняется согласованная пара).
// ============================================================================
import type { MaterialContent, MaterialRequest } from '../../../lib/materials'
import type { MaterialPlan } from '../../../types'

export type Step =
  | { name: 'form' }
  | { name: 'plan'; req: MaterialRequest; plan: MaterialPlan }
  // own: материал по своему тексту преподавателя (плана нет, назад — к форме)
  | { name: 'preview'; req: MaterialRequest; plan: MaterialPlan; content: MaterialContent; own?: boolean }

/** Шаги по порядку; at — где сейчас, всё после него — готовое впереди. */
export interface Flow {
  steps: Step[]
  at: number
}

export const START: Flow = { steps: [{ name: 'form' }], at: 0 }

export const current = (f: Flow): Step => f.steps[f.at] ?? { name: 'form' }

/** Готовый шаг впереди — к нему ведёт «Вернуться к …». */
export const ahead = (f: Flow): Step | undefined => f.steps[f.at + 1]

export const back = (f: Flow): Flow => ({ ...f, at: Math.max(0, f.at - 1) })

export const forward = (f: Flow): Flow => ({ ...f, at: Math.min(f.steps.length - 1, f.at + 1) })

/** Новый результат на следующем шаге: прежнее впереди — другая ветка, убирается. */
export function advance(f: Flow, next: Step): Flow {
  const steps = [...f.steps.slice(0, f.at + 1), next]
  return { steps, at: steps.length - 1 }
}

/** Тот же шаг с новым результатом; готовое впереди остаётся. */
export function replace(f: Flow, step: Step): Flow {
  const steps = [...f.steps]
  steps[f.at] = step
  return { steps, at: f.at }
}

const STEP_NAMES = new Set(['form', 'plan', 'preview'])

/**
 * Черновик мастера → шаги; null — мастер не начат (список материалов).
 * До Ф2.11 в черновике лежал один шаг ({ name: 'plan', req, plan }) — такой
 * восстанавливается с шагами позади, чтобы «назад» вёл туда же, что и раньше.
 */
export function fromDraft(raw: unknown): Flow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<Flow> & { name?: string }
  if (Array.isArray(r.steps) && r.steps.length > 0 && typeof r.at === 'number') {
    const valid = r.steps.every((s) => s && STEP_NAMES.has((s as Step).name))
    return valid ? { steps: r.steps, at: Math.min(Math.max(0, r.at), r.steps.length - 1) } : null
  }
  const step = raw as Step
  if (step.name === 'form') return START
  if (step.name === 'plan') return advance(START, step)
  if (step.name === 'preview') {
    return step.own
      ? advance(START, step)
      : advance(advance(START, { name: 'plan', req: step.req, plan: step.plan }), step)
  }
  return null
}
