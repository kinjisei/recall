// ============================================================================
// Число «ждут проверки» на вкладке «Задания» учителя (PLAN.md Ф2.10, макет
// t1). Живёт в стартовом коде каркаса, поэтому лёгкое: запрос писем
// (lib/writing) подгружается при первом пересчёте — у ученика не грузится
// вовсе. Список работ — waitingWorks.ts; при загрузке он обновляет и число.
// Перечитывается при входе учителя и при возврате в приложение.
// ============================================================================
import { useEffect, useSyncExternalStore } from 'react'
import { countSubmittedWorks } from '../../lib/materials'

let count = 0
const listeners = new Set<() => void>()

/** Новое число (список «Проверки работ» загрузился). */
export function publishWaitingCount(n: number): void {
  if (n === count) return
  count = n
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** Перечитать число. Сбой связи — прежнее: выдуманный «0» хуже (Ф1.13). */
export function refreshWaitingCount(): void {
  Promise.all([import('../../lib/writing').then((m) => m.countSubmittedWriting()), countSubmittedWorks()])
    .then(([a, b]) => publishWaitingCount(a + b))
    .catch(() => {})
}

/** Сколько работ ждёт проверки. Выключен (не учитель) — 0 и ни одного запроса. */
export function useWaitingCount(enabled: boolean): number {
  const n = useSyncExternalStore(subscribe, () => count)
  useEffect(() => {
    if (!enabled) return
    refreshWaitingCount()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshWaitingCount()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [enabled])
  return enabled ? n : 0
}
