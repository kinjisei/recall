// ============================================================================
// «Ждут проверки» (PLAN.md Ф2.10): сданные учениками работы, которые учитель
// ещё не проверил, — письма и задания по материалам. Запросы — одни на
// счётчик вкладки «Задания» и на список «Проверка работ» (lib/reviewQueue):
// два числа про одно и то же разойдутся — и учитель перестанет верить обоим.
//
// Список — здесь (экран «Задания», грузится лениво), счётчик меню —
// waitingCount.ts (в стартовом коде каркаса). Список при каждой загрузке
// обновляет счётчик: после проверки учитель возвращается в «Задания», и
// число на вкладке сходится со списком.
// ============================================================================
import {
  lastReviewedWorkAt,
  lastReviewedWritingAt,
  listSubmittedWorks,
  listSubmittedWriting,
  type SubmittedWork,
  type SubmittedWriting,
} from '../../lib/reviewQueue'
import { publishWaitingCount } from './waitingCount'

export type WaitingWork = ({ kind: 'writing' } & SubmittedWriting) | ({ kind: 'material' } & SubmittedWork)

/**
 * Оба вида одним списком: сданная последней — первой, старые — ниже (макеты
 * t1-3 и d7-1, «старые — ниже»; до Ф2.17-4в первой стояла самая старая).
 * Сбой — исключение, а не «никто не сдал».
 */
export async function loadWaitingWorks(): Promise<WaitingWork[]> {
  const [writing, works] = await Promise.all([listSubmittedWriting(), listSubmittedWorks()])
  const all: WaitingWork[] = [
    ...writing.map((w) => ({ kind: 'writing' as const, ...w })),
    ...works.map((w) => ({ kind: 'material' as const, ...w })),
  ].sort((a, b) => (b.assignment.submitted_at ?? '').localeCompare(a.assignment.submitted_at ?? ''))
  publishWaitingCount(all.length)
  return all
}

/** Когда пришла последняя (уже проверенная) работа — «Всё проверено · последняя работа — вчера». */
export async function loadLastReviewedAt(): Promise<string | null> {
  const [a, b] = await Promise.all([lastReviewedWritingAt(), lastReviewedWorkAt()])
  return [a, b].filter((x): x is string => !!x).sort().pop() ?? null
}

/** «Работа 2 из 2»: где эта работа в очереди и какая откроется следующей (по кругу, макет d7-2). */
export function queuePlace(list: readonly WaitingWork[], id: string): { index: number; prev: WaitingWork | null; next: WaitingWork | null } {
  const index = list.findIndex((w) => w.assignment.id === id)
  if (index === -1 || list.length < 2) return { index, prev: null, next: null }
  const at = (i: number) => list[(i + list.length) % list.length] ?? null
  return { index, prev: at(index - 1), next: at(index + 1) }
}
