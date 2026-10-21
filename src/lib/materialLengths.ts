// ============================================================================
// Описание: src/features/teacher/CLAUDE.md
// Длина текста материала (макет d8-2, журнал п.76 (7)): «~120 слов / ~200 /
// ~300» — цели 100–140 / 180–220 / 270–330 слов. Диапазон уходит в промпт
// («Длина: 100-140 слов») и в проверку качества (scripts/ai-quality/rules.mjs:
// любой «a-b» ± 10 %). До 21.10.2026 были 50–100 / 100–250 / 250–350 — они
// живут в старых материалах и черновиках и понимаются как прежде.
// ============================================================================

export const MATERIAL_LENGTHS = ['100-140', '180-220', '270-330'] as const
export type MaterialLength = (typeof MATERIAL_LENGTHS)[number] | '50-100' | '100-250' | '250-350'

/** «~120 слов» — подпись кнопки длины (d8-2: «~120 слов · ~200 · ~300»). */
export const LENGTH_LABEL: Record<(typeof MATERIAL_LENGTHS)[number], string> = {
  '100-140': '~120 слов',
  '180-220': '~200',
  '270-330': '~300',
}

/**
 * «~200 слов» — всегда со словом, и для старого диапазона: итог мастера,
 * строка статьи (на кнопках длины «слов» только у первой — LENGTH_LABEL).
 */
export function lengthLabel(range: string): string {
  const [a, b] = range.split('-').map(Number)
  return a && b ? `~${Math.round((a + b) / 2 / 10) * 10} слов` : range
}

/** Сколько вопросов на понимание просить у плана под эту длину. */
export function comprehensionRange(range: string): string {
  if (range === '50-100' || range === '100-140') return '3-5'
  if (range === '100-250' || range === '180-220') return '5-8'
  return '7-12'
}

/** Длина-корзина по числу слов в своём тексте («Мой текст»). */
export function lengthRangeOf(body: string): MaterialLength {
  const n = body.split(/\s+/).filter(Boolean).length
  return n < 160 ? '100-140' : n <= 250 ? '180-220' : '270-330'
}
