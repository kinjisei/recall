// ============================================================================
// Дневные лимиты моделей AI у поставщиков — для блока «Расход AI» в /admin
// (PLAN.md Ф1.6). Без импортов: читают и экран, и чистый тест.
//
// ⚠️ Лимит — на ВЕСЬ проект (один ключ на всех), а не на человека. Цепочка
// моделей их складывает: у каждой модели свой счётчик (api/_core.ts).
//
// Откуда числа:
//   • Google свои лимиты больше не публикует — страница
//     https://ai.google.dev/gemini-api/docs/rate-limits отправляет в AI Studio,
//     где они видны только для своего проекта (Dashboard → Rate limits).
//     Сутки Google обнуляет в полночь по Тихоокеанскому времени.
//   • Groq публикует открыто: https://console.groq.com/docs/rate-limits
// У каждой строки — откуда и когда. null — число неизвестно: блок покажет
// расход без шкалы. Узнать — AI Studio → Rate limits, строка модели.
// Новая модель в цепочке без строки здесь — красный test-ai-limits.mjs.
// ============================================================================

export interface ModelLimit {
  /** Запросов в сутки на весь проект; null — неизвестно. */
  rpd: number | null
  /** Запросов в минуту; null — неизвестно. */
  rpm: number | null
  /** Откуда число и когда сверено. */
  source: string
}

// Free tier, проект «Default Gemini Project»: Rate Limit → «Rate limits by model»
const AI_STUDIO = 'AI Studio владельца (Rate Limit, Free tier), 28.09.2026'
const AI_STUDIO_JULY = 'AI Studio владельца, 24.07.2026'
const NOT_CHECKED = 'не сверено — AI Studio → Rate limits → See more'
const GROQ = 'console.groq.com/docs/rate-limits, 28.09.2026'

export const MODEL_LIMITS: Record<string, ModelLimit> = {
  // standard — Диалог, письмо, квесты, разбор работ
  'gemini-3.6-flash': { rpd: 20, rpm: 5, source: AI_STUDIO },
  'gemini-3.5-flash': { rpd: 20, rpm: 5, source: AI_STUDIO },
  'gemini-2.5-flash': { rpd: 20, rpm: 5, source: AI_STUDIO },
  // lite — перевод слова и определения (после Groq)
  'gemini-3.5-flash-lite': { rpd: 500, rpm: 15, source: AI_STUDIO },
  'gemini-3.1-flash-lite': { rpd: null, rpm: null, source: NOT_CHECKED },
  'gemma-4-31b-it': { rpd: 14_400, rpm: 30, source: AI_STUDIO_JULY },
  'gemini-2.5-flash-lite': { rpd: null, rpm: null, source: NOT_CHECKED },
  // max — материалы и программы учителя
  'gemini-2.5-pro': { rpd: null, rpm: null, source: NOT_CHECKED },
  'gemini-3.1-pro-preview': { rpd: null, rpm: null, source: NOT_CHECKED },
  // Groq: первая модель лёгких задач, последний рубеж обычных, речь
  'openai/gpt-oss-20b': { rpd: 1_000, rpm: 30, source: GROQ },
  'openai/gpt-oss-120b': { rpd: 1_000, rpm: 30, source: GROQ },
  'whisper-large-v3-turbo': { rpd: 2_000, rpm: 20, source: GROQ },
}
