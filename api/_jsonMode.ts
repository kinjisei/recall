// ============================================================================
// Что клиент просит про JSON (Ф2.20, журнал п.77): `true` — режим JSON у
// модели, объект — схема ответа (JSON Schema, api/_geminiBody.ts). Схема
// только формирует ответ самому спросившему, но объём держим в узде: больше
// SCHEMA_MAX или не объект — просто режим JSON / без него. Файл с «_» —
// Vercel НЕ делает из него отдельную функцию. Держит test-ai-prompts.
// ============================================================================

/** Схема ответа от клиента — не больше этого (схема разбора письма ~2,5 КБ). */
export const SCHEMA_MAX = 8_000

export function jsonMode(v: unknown): boolean | Record<string, unknown> {
  if (v === true) return true
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  return JSON.stringify(v).length <= SCHEMA_MAX ? (v as Record<string, unknown>) : true
}
