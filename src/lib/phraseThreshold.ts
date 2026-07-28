// ============================================================================
// Порог показа кнопки «Разбор предложения» при выделении фразы в читалке.
// Чистая функция без зависимостей — чтобы покрыть мини-тестом (node).
// ============================================================================
const HAS_LETTER = /[A-Za-zÀ-ÿ]/
// частые сокращения — точка после них НЕ конец предложения
const ABBR = /^(mr|mrs|ms|dr|prof|st|vs|etc)\.?$/i

/**
 * Кнопку разбора предлагаем, если выделено ≥5 слов ИЛИ выделение доходит до конца
 * предложения (последнее слово оканчивается на .!?… и это не сокращение).
 * tokens — токены из TappableText (split по пробелам/тире/многоточию), a..b — диапазон.
 */
export function shouldOfferAnalysis(tokens: string[], a: number, b: number): boolean {
  const words = tokens.slice(a, b + 1).filter((t) => HAS_LETTER.test(t))
  if (words.length >= 5) return true
  const last = (words[words.length - 1] ?? '').trim()
  return /[.!?…]$/.test(last) && !ABBR.test(last)
}
