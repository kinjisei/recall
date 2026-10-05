// ============================================================================
// «Ждут проверки» (PLAN.md Ф2.10): сданные учениками работы, которые учитель
// ещё не проверил, — письма и задания по материалам. Одно место на счётчик
// вкладки «Задания» в меню и на список «Проверка работ»: два числа про одно и
// то же разойдутся — и учитель перестанет верить обоим.
//
// Список — здесь (экран «Задания», грузится лениво), счётчик меню —
// waitingCount.ts (в стартовом коде каркаса). Список при каждой загрузке
// обновляет счётчик: после проверки учитель возвращается в «Задания», и
// число на вкладке сходится со списком.
// ============================================================================
import { listSubmittedWorks, type SubmittedWork } from '../../lib/materials'
import { listSubmittedWriting, type SubmittedWriting } from '../../lib/writing'
import { publishWaitingCount } from './waitingCount'

export type WaitingWork = ({ kind: 'writing' } & SubmittedWriting) | ({ kind: 'material' } & SubmittedWork)

/** Оба вида одним списком: дольше всех ждёт — первым. Сбой — исключение, а не «никто не сдал». */
export async function loadWaitingWorks(): Promise<WaitingWork[]> {
  const [writing, works] = await Promise.all([listSubmittedWriting(), listSubmittedWorks()])
  const all: WaitingWork[] = [
    ...writing.map((w) => ({ kind: 'writing' as const, ...w })),
    ...works.map((w) => ({ kind: 'material' as const, ...w })),
  ].sort((a, b) => (a.assignment.submitted_at ?? '').localeCompare(b.assignment.submitted_at ?? ''))
  publishWaitingCount(all.length)
  return all
}
