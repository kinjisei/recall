// ============================================================================
// Ответ замены — ровно одно упражнение нужного вида (PLAN.md Ф2.25-4, по
// образцу _planShape.ts). Файл с «_» — Vercel НЕ делает из него функцию.
//
// Текст запроса собирает клиент, поэтому заменой можно попросить что угодно
// — например, целый материал или перевод. Генерацию замена не тратит, и без
// этой проверки она была бы AI на любой текст за счёт лимита замен, а не
// генераций. Пропускаем только {"exercises": [одно упражнение]}: ключи
// упражнения, тип вида, короткие строки и короткие списки. Не упражнение —
// 422, и замена НЕ возвращается (api/gemini.ts): иначе по кругу «спросил
// текст → не упражнение → замена вернулась» модель гонялась бы бесплатно.
// Насколько упражнение хорошее, решает клиент (`domains/materials/swap.ts`).
// ============================================================================
import type { SwapFormat } from './_swap.js'

/** Самое длинное упражнение — 8 пар с объяснениями — около 1 500 знаков. */
const MAX_CHARS = 4000
const KEYS = new Set(['kind', 'type', 'format', 'prompt', 'options', 'answer', 'quote', 'mark', 'why', 'hint', 'words', 'pairs', 'extra'])

/** Тип упражнения и поле format у вида каталога (как `lib/exerciseFormats` + `formatOf`). */
const SHAPE: Record<SwapFormat, { type: string; format?: string }> = {
  mcq: { type: 'mcq' },
  tfng: { type: 'mcq', format: 'tfng' },
  word_by_definition: { type: 'mcq' },
  form: { type: 'mcq', format: 'form' },
  fill_word: { type: 'fill' },
  fill_form: { type: 'fill' },
  order: { type: 'order' },
  match_translation: { type: 'match', format: 'translation' },
  match_definition: { type: 'match', format: 'definition' },
}

const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max
const strs = (v: unknown, min: number, max: number, each: number) => Array.isArray(v) && v.length >= min && v.length <= max && v.every((s) => str(s, each))

export function isExerciseShaped(raw: string, format: SwapFormat): boolean {
  if (typeof raw !== 'string' || raw.length > MAX_CHARS) return false
  const s = raw.indexOf('{')
  const e = raw.lastIndexOf('}')
  if (s === -1 || e <= s) return false
  let o: unknown
  try {
    o = JSON.parse(raw.slice(s, e + 1))
  } catch {
    return false
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false
  const top = o as Record<string, unknown>
  if (Object.keys(top).some((k) => k !== 'exercises')) return false
  const list = top.exercises
  if (!Array.isArray(list) || list.length !== 1) return false
  const ex = list[0] as Record<string, unknown>
  if (!ex || typeof ex !== 'object' || Array.isArray(ex)) return false
  if (Object.keys(ex).some((k) => !KEYS.has(k))) return false

  const want = SHAPE[format]
  if (ex.type !== want.type) return false
  if (want.format && ex.format !== want.format) return false
  if (!str(ex.prompt, 400) || !str(ex.kind ?? '', 30) || !str(ex.format ?? '', 30)) return false
  if (!str(ex.quote ?? '', 400) || !str(ex.mark ?? '', 80) || !str(ex.why ?? '', 300) || !str(ex.hint ?? '', 200)) return false

  switch (want.type) {
    case 'mcq':
      return strs(ex.options, 2, 6, 200) && Number.isInteger(ex.answer)
    case 'fill':
      return str(ex.answer, 120)
    case 'order':
      return strs(ex.words, 2, 15, 40) && strs(ex.answer, 2, 15, 40)
    default: {
      // match
      const pairs = ex.pairs
      const okPairs =
        Array.isArray(pairs) &&
        pairs.length >= 1 &&
        pairs.length <= 10 &&
        pairs.every((p) => {
          if (!p || typeof p !== 'object' || Array.isArray(p)) return false
          const q = p as Record<string, unknown>
          return Object.keys(q).every((k) => k === 'left' || k === 'right') && str(q.left, 100) && str(q.right, 200)
        })
      return okPairs && (ex.extra === undefined || strs(ex.extra, 0, 3, 200))
    }
  }
}
