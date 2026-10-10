// Общее для экранов «Материалов» (форма/план/предпросмотр/деталь) и письменного задания.
import type { CEFRLevel } from '../../../types'

export const LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export const inputClass =
  'w-full rounded-lg border border-tint/[0.10] bg-input px-3 py-2 text-sm outline-none focus:border-accent-line'

/** Кнопка-выбор в формах (язык, уровень, для кого). */
export const chip = (active: boolean) =>
  `rounded-lg px-3 py-1.5 text-sm font-semibold ${
    active ? 'bg-accent-soft text-accent-soft-fg' : 'bg-tint/[0.07] text-fg-secondary'
  }`
