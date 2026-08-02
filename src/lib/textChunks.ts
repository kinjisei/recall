// ============================================================================
// Резка текста на части для «Разбора всего текста». Чистые функции без
// зависимостей — покрыты мини-тестом (node). Части ~200 слов, не рвём
// предложения; цена разбора = число частей + 1 (финальный синтез).
// ============================================================================

/** Режем текст на части ~targetWords слов, склеивая целые предложения. */
export function splitChunks(text: string, targetWords = 200): string[] {
  const t = text.trim()
  if (!t) return []
  // предложение = до .!?… включительно (с хвостовыми пробелами); если пунктуации
  // нет — весь текст одним куском
  const sentences = t.match(/[^.!?…]+[.!?…]*\s*/g) ?? [t]
  const chunks: string[] = []
  let cur = ''
  let words = 0
  for (const sent of sentences) {
    const w = (sent.trim().match(/\S+/g) ?? []).length
    if (words > 0 && words + w > targetWords) {
      chunks.push(cur.trim())
      cur = ''
      words = 0
    }
    cur += sent
    words += w
  }
  if (cur.trim()) chunks.push(cur.trim())
  return chunks.length ? chunks : [t]
}

/** Оценка стоимости разбора в AI-действиях = части + 1 (синтез). */
export function estimateCost(text: string): number {
  return splitChunks(text).length + 1
}

/** Самый частый непустой элемент (для итогового уровня из уровней частей). */
export function mostCommon(arr: string[]): string {
  const count: Record<string, number> = {}
  let best = ''
  let n = 0
  for (const a of arr) {
    if (!a) continue
    count[a] = (count[a] || 0) + 1
    if (count[a] > n) {
      n = count[a]
      best = a
    }
  }
  return best
}
