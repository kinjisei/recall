// ============================================================================
// Утилиты для мини-игр «Практики».
//   shuffle / sample — случайный порядок и выборка;
//   normalize        — сравнение ответов без учёта регистра/диакритики;
//   loadWordPool     — ленивая загрузка словаря, отфильтрованного под игры
//                      (короткие слова/фразы с переводом).
// ============================================================================

/** Возвращает НОВЫЙ массив в случайном порядке (Фишер–Йейтс). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** n случайных элементов без повторов. */
export function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, n)
}

/** Нормализация ответа: без регистра, диакритики и лишних пробелов. */
export function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

export interface PoolWord {
  es: string
  ru: string
}

let poolPromise: Promise<PoolWord[]> | null = null

/**
 * Ленивая загрузка словаря для игр: только слова/короткие фразы с переводом
 * (длинные фразы из «диалоговых» паков и дубли отсеиваются).
 */
export function loadWordPool(): Promise<PoolWord[]> {
  if (!poolPromise) {
    poolPromise = import('../../data/spanish/words').then((m) => {
      const seen = new Set<string>()
      const pool: PoolWord[] = []
      for (const w of m.allWords) {
        const es = w.spanish?.trim()
        const ru = w.russian?.trim()
        if (!es || !ru) continue
        if (es.split(/\s+/).length > 3 || es.length > 24) continue // не берём длинные фразы
        const key = es.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        pool.push({ es, ru })
      }
      return pool
    })
  }
  return poolPromise
}
