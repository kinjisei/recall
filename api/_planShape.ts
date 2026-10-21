// ============================================================================
// Ответ модели — план материала по форме (PLAN.md Ф2.17-4в-2б, миграция 0014).
// Файл с «_» — Vercel НЕ делает из него отдельную функцию.
//
// Текст запроса собирает клиент (lib/materials), поэтому бесплатным повтором
// плана можно попросить что угодно — например, целый текст с упражнениями.
// Сервер пропускает только план: ровно ключи плана, короткий комментарий,
// список слов и упражнений без самих упражнений. Неплан повтор не возвращает
// (api/gemini.ts): иначе по кругу «спросил текст → не план → повтор вернулся»
// гонялась бы дорогая модель бесплатно.
// ============================================================================

const PLAN_KEYS = new Set(['comments', 'vocabulary', 'grammar_focus', 'exercise_plan'])
/** Весь ответ: план с комментарием в 4 предложения и 10 словами — около 1 500 знаков. */
const MAX_CHARS = 4000

const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max

export function isPlanShaped(raw: string): boolean {
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
  const p = o as Record<string, unknown>
  if (Object.keys(p).some((k) => !PLAN_KEYS.has(k))) return false
  if (!str(p.comments ?? '', 1200)) return false
  if (p.grammar_focus != null && !str(p.grammar_focus, 160)) return false
  const words = p.vocabulary
  if (!Array.isArray(words) || words.length > 15 || !words.every((w) => str(w, 60))) return false
  const ex = p.exercise_plan
  if (!Array.isArray(ex) || ex.length === 0 || ex.length > 10) return false
  return ex.every((x) => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return false
    const it = x as Record<string, unknown>
    if (Object.keys(it).some((k) => !['kind', 'type', 'count', 'note'].includes(k))) return false
    return str(it.kind, 30) && str(it.type ?? '', 30) && (it.count == null || (typeof it.count === 'number' && it.count <= 20)) && str(it.note ?? '', 200)
  })
}
