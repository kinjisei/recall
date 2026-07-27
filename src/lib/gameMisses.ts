// ============================================================================
// Счётчик промахов по слову в мини-играх (localStorage, у каждого устройства
// свой). Нужен, чтобы отличить случайную оплошность от реального незнания.
//
// Зачем: промах в игре на скорость с четырьмя вариантами — не то же самое, что
// не вспомнить слово в «Повторении». Раньше любой такой промах ставил карточке
// самую жёсткую оценку, и одна ошибка отбрасывала зрелое слово с интервала
// 57 дней на ноль (замерено scripts/test-fsrs-graduation.mjs). Теперь обычный
// промах стоит «сложно», а «не знаю» включается, только если по одному слову
// промахнулся MISS_LIMIT раз за MISS_WINDOW_DAYS — это уже не случайность.
// ============================================================================

import { readJson, writeJson } from './storage'

const KEY = 'recall.game_misses'
const MISS_WINDOW_DAYS = 7
const MISS_LIMIT = 3
const WINDOW_MS = MISS_WINDOW_DAYS * 86400000

type MissLog = Record<string, number[]>

function read(): MissLog {
  const v = readJson<MissLog>(KEY, {})
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
}

function write(log: MissLog): void {
  writeJson(KEY, log)
}

/**
 * Записать промах и сказать, серьёзный ли он.
 * true — по этому слову промахов накопилось достаточно, чтобы вернуть его
 * на переучивание; false — разовая оплошность.
 */
export function recordMiss(cardId: string): boolean {
  const now = Date.now()
  const log = read()

  // чистим протухшее по всем словам разом, иначе запись растёт вечно
  for (const [id, times] of Object.entries(log)) {
    const fresh = times.filter((t) => now - t < WINDOW_MS)
    if (fresh.length === 0) delete log[id]
    else log[id] = fresh
  }

  const mine = [...(log[cardId] ?? []), now]
  log[cardId] = mine
  write(log)
  return mine.length >= MISS_LIMIT
}

/** Забыть промахи по слову — например, после успешного повторения. */
export function clearMisses(cardId: string): void {
  const log = read()
  if (log[cardId]) {
    delete log[cardId]
    write(log)
  }
}
