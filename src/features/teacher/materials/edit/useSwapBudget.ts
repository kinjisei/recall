// ============================================================================
// Остаток замен через AI на сегодня (PLAN.md Ф2.25-4б, кадры d17-1, d17-3в):
// до первой замены — из базы (`loadSwapCounters`), после замены — из ответа
// сервера, после отказа — заново из базы (контракт 4а). Сбой — ошибка с
// «Повторить», а не «0» (Ф1.13): кнопки тогда работают, решит сервер.
// Учитель вернулся в приложение (могла наступить полночь по Алматы) —
// перечитываем.
// ============================================================================
import { useCallback } from 'react'
import { loadSwapCounters, type SwapCounters } from '../../../../domains/materials'
import { useAsyncData } from '../../../../shared/lib/useAsyncData'
import { useOnReturn } from '../../../../shared/lib/useOnReturn'
import { spent } from './swapPlan'

export interface SwapBudget {
  counters: SwapCounters | null
  error: string | null
  reload: () => void
  /** Ответ сервера: сколько осталось после этой замены. */
  set: (c: SwapCounters) => void
  /** Нажали «Заменить» — минус одна сразу (d17-2: «23 из 25», пока AI пишет). */
  spend: (strong: boolean) => void
  /** Сервер отказал по лимиту — кончились все или сложные. */
  out: (strongOnly: boolean) => void
}

export function useSwapBudget(): SwapBudget {
  const { data, error, reload, set } = useAsyncData(loadSwapCounters, [], 'Не удалось узнать, сколько замен осталось')
  useOnReturn(reload)
  return {
    counters: data,
    error,
    reload,
    set: useCallback((c: SwapCounters) => set(() => c), [set]),
    spend: useCallback((strong: boolean) => set((c) => (c ? spent(c, strong) : c)), [set]),
    // сколько всех осталось, при «кончились сложные» не знаем — его скажет перечитывание
    out: useCallback((strongOnly: boolean) => set((c) => (strongOnly ? c && { ...c, strongLeft: 0 } : { left: 0, strongLeft: 0 })), [set]),
  }
}
