// ============================================================================
// Умные обманки для игр слов. Жалоба владельца: незнакомое слово угадывалось
// исключением — обманки были случайными («day off» с вариантами «ломтик»,
// «испечь»…). Правило: обманка должна быть ПОХОЖА на правильный ответ —
// та же тема, тот же уровень, та же часть речи, сравнимая длина; а правильный
// ответ не должен выделяться длиной в четвёрке.
// Чистый модуль без клиента БД — тестируется scripts/test-distractors.mjs.
// ============================================================================

export interface DistractorItem {
  term: string
  translation: string
  level?: string
  topic?: number
}

export type RuPos = 'verb' | 'adj' | 'adv' | 'noun'

/** Часть речи по русскому переводу (первое слово до запятой). Эвристика. */
export function ruPos(ru: string): RuPos {
  const w = (ru.split(/[,;·(]/)[0] ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  if (/(ться|тись|ть|чь)$/.test(w)) return 'verb'
  if (/о$/.test(w) && w.length > 4) return 'adv' // быстро, медленно
  if (/(ый|ой|ий|ая|яя|ое|ее|ые|ие|ний|ший)$/.test(w)) return 'adj'
  return 'noun'
}

/**
 * n обманок, максимально похожих на правильный ответ.
 * key — что показывается в вариантах: перевод (Быстрый перевод) или само
 * слово (Пропущенное слово). Похожесть считаем и по атрибутам слова
 * (тема/уровень/часть речи), и по длине показываемой строки.
 */
export function pickDistractors(
  correct: DistractorItem,
  pool: DistractorItem[],
  n: number,
  key: (i: DistractorItem) => string,
): string[] {
  const right = key(correct)
  const rightPos = ruPos(correct.translation)
  const seen = new Set([right.toLowerCase()])

  const scored = pool
    .filter((p) => {
      const k = key(p)
      if (!k || seen.has(k.toLowerCase())) return false
      if (p.term.toLowerCase() === correct.term.toLowerCase()) return false
      seen.add(k.toLowerCase())
      return true
    })
    .map((p) => {
      let score = Math.random() // случайный разрыв ничьих
      if (correct.topic != null && p.topic === correct.topic) score += 4
      if (correct.level && p.level === correct.level) score += 2
      if (ruPos(p.translation) === rightPos) score += 3
      // близость длины показываемой строки: разница >40% — штраф
      const dl = Math.abs(key(p).length - right.length) / Math.max(right.length, 1)
      score += dl <= 0.4 ? 2 - dl * 2 : -2
      return { key: key(p), score, len: key(p).length }
    })
    .sort((a, b) => b.score - a.score)

  const picked = scored.slice(0, n)

  // правильный ответ не должен быть крайним по длине с большим отрывом —
  // иначе он «светится» в четвёрке; меняем крайнюю обманку на ближе по длине
  const fits = (list: { len: number }[]) => {
    const lens = list.map((x) => x.len)
    const min = Math.min(...lens, right.length)
    const max = Math.max(...lens, right.length)
    const margin = 0.35
    if (right.length === max && right.length > Math.max(...lens) * (1 + margin)) return false
    if (right.length === min && right.length * (1 + margin) < Math.min(...lens)) return false
    return true
  }
  if (picked.length === n && !fits(picked)) {
    const rest = scored.slice(n)
    // ищем замену, приближающую разброс длин к правильному ответу
    const worstIdx = picked.reduce(
      (wi, x, i) =>
        Math.abs(x.len - right.length) > Math.abs(picked[wi].len - right.length) ? i : wi,
      0,
    )
    const better = rest.find(
      (r) => Math.abs(r.len - right.length) < Math.abs(picked[worstIdx].len - right.length),
    )
    if (better) picked[worstIdx] = better
  }

  return picked.map((p) => p.key)
}
