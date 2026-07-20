// ============================================================================
// «Начать занятие» — короткая ведомая сессия: колода → чтение → речь.
// Намеренно без state-менеджера: шаг лежит в sessionStorage, каждый экран в
// конце спрашивает nextGuidedStep() и, если сессия идёт, показывает кнопку
// перехода к следующему шагу. Закрыл вкладку — сессия просто забылась.
// ============================================================================

const KEY = 'recall.guided'

/** Порядок шагов ведомой сессии. */
export const GUIDED_STEPS = ['flashcards', 'reader', 'pronunciation'] as const
export type GuidedStep = (typeof GUIDED_STEPS)[number]

const ROUTES: Record<GuidedStep, string> = {
  flashcards: '/flashcards',
  reader: '/study',
  pronunciation: '/pronunciation',
}

const TITLES: Record<GuidedStep, string> = {
  flashcards: 'повторение слов',
  reader: 'чтение',
  pronunciation: 'речь',
}

/** Начать сессию с первого шага. */
export function startGuided(): string {
  sessionStorage.setItem(KEY, GUIDED_STEPS[0])
  return ROUTES[GUIDED_STEPS[0]]
}

/** Идёт ли сессия и на каком шаге. */
export function currentGuidedStep(): GuidedStep | null {
  const v = sessionStorage.getItem(KEY)
  return (GUIDED_STEPS as readonly string[]).includes(v ?? '') ? (v as GuidedStep) : null
}

export function stopGuided(): void {
  sessionStorage.removeItem(KEY)
}

/**
 * Что предложить после завершения шага `step`.
 * null — сессия не идёт, мы не на этом шаге, или это был последний шаг
 * (тогда сессия закрывается).
 */
export function nextGuidedStep(
  step: GuidedStep,
): { route: string; title: string; label: string } | null {
  if (currentGuidedStep() !== step) return null
  const next = GUIDED_STEPS[GUIDED_STEPS.indexOf(step) + 1]
  if (!next) {
    stopGuided()
    return null
  }
  sessionStorage.setItem(KEY, next)
  return { route: ROUTES[next], title: TITLES[next], label: `Дальше: ${TITLES[next]} →` }
}
