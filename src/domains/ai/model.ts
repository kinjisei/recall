// ============================================================================
// Расход AI — модель (PLAN.md Ф1.6): строки сводки и чистые правила. Сводку
// считает база (admin_ai_usage, admin_ai_tasks); здесь — «сколько из дневного
// лимита», «когда обнулится» и подписи. Без импортов кода (только типы) —
// чистый тест в node: scripts/test-ai-usage.mjs.
// ============================================================================
import type { ModelLimit } from './limits'

/** Попытки одной модели за сутки Google (по Тихоокеанскому времени). */
export interface ModelDay {
  /** 'ГГГГ-ММ-ДД' */
  day: string
  model: string
  requests: number
  ok: number
  /** 429 — отказ по квоте (минутной или дневной). */
  refused: number
  /** Остальные отказы: сбой у поставщика, срок вышел, связь, пустой ответ. */
  failed: number
  avg_ms: number | null
  p95_ms: number | null
  /** Поток «Диалога»: сколько в среднем ждали первые слова. */
  avg_first_ms: number | null
}

/** Вызовы одной задачи за сутки: что увидел человек. */
export interface TaskDay {
  day: string
  task: string
  calls: number
  ok: number
  /** Ответа не было — энергия вернулась. */
  failed: number
  /** Поток оборвался на середине — энергия вернулась. */
  cut: number
  avg_ms: number | null
  p95_ms: number | null
}

/** Модель сегодня: расход против дневного лимита. */
export interface ModelToday extends ModelDay {
  limit: ModelLimit | null
  /** Попыток в счёт дневного лимита: всё, кроме отказов 429. */
  used: number
  /** Доля лимита (1 — исчерпан); null — лимит неизвестен. */
  share: number | null
}

/**
 * Модели за сутки `day` — сперва ближайшие к дневному лимиту, модели без
 * известного лимита — после них, по числу попыток. limits — MODEL_LIMITS.
 */
export function modelsOnDay(
  rows: ModelDay[],
  day: string,
  limits: Record<string, ModelLimit>,
): ModelToday[] {
  return rows
    .filter((r) => r.day === day)
    .map((r) => {
      const limit = limits[r.model] ?? null
      const used = r.requests - r.refused
      return { ...r, limit, used, share: limit?.rpd ? used / limit.rpd : null }
    })
    .sort((a, b) => (b.share ?? -1) - (a.share ?? -1) || b.requests - a.requests)
}

export interface DayTotal {
  day: string
  requests: number
  ok: number
  refused: number
  failed: number
}

/** Итог по дням (все модели вместе), свежие сверху. */
export function dayTotals(rows: ModelDay[]): DayTotal[] {
  const by = new Map<string, DayTotal>()
  for (const r of rows) {
    const t = by.get(r.day) ?? { day: r.day, requests: 0, ok: 0, refused: 0, failed: 0 }
    t.requests += r.requests
    t.ok += r.ok
    t.refused += r.refused
    t.failed += r.failed
    by.set(r.day, t)
  }
  return [...by.values()].sort((a, b) => b.day.localeCompare(a.day))
}

const LA = 'America/Los_Angeles'

/** Сутки Google — дата по Тихоокеанскому времени, 'ГГГГ-ММ-ДД'. */
export function googleDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: LA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Часы Лос-Анджелеса на момент d (секундная точность). */
function laParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LA,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((x) => x.type === type)?.value ?? 0)
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute'), s: get('second') }
}

/** На сколько часы Лос-Анджелеса впереди UTC в момент d, мс (летом −7 ч, зимой −8 ч). */
function laOffset(d: Date): number {
  const p = laParts(d)
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(d.getTime() / 1000) * 1000
}

/**
 * Когда Google обнулит дневные квоты — ближайшая полночь по Тихоокеанскому
 * времени. Смещение пересчитывается на саму полночь: ночь перевода часов.
 */
export function quotaReset(now: Date): Date {
  const p = laParts(now)
  const wall = Date.UTC(p.y, p.m - 1, p.d + 1) // полночь следующих суток на часах ЛА
  const guess = wall - laOffset(now)
  return new Date(wall - laOffset(new Date(guess)))
}

/** «через 3 ч 20 мин» / «через 40 мин». */
export function untilLabel(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000))
  const h = Math.floor(min / 60)
  return h > 0 ? `через ${h} ч ${min % 60} мин` : `через ${min} мин`
}

/** Задержка по-человечески: «0,3 с», «12 с». */
export function secondsLabel(ms: number | null): string {
  if (ms === null) return '—'
  const s = ms / 1000
  return `${(s < 10 ? s.toFixed(1) : Math.round(s).toString()).replace('.', ',')} с`
}

/** Задачи AI по-русски (api/_tasks.ts + речь). Неизвестная — как есть. */
export const TASK_LABELS: Record<string, string> = {
  word: 'Перевод слова',
  definition: 'Определения',
  analyze: 'Разбор фрагмента',
  dialog: 'Диалог',
  writing: 'Письмо',
  quest: 'Квесты',
  review: 'Разбор работы',
  material: 'Материал ученику',
  program: 'Программа',
  homework: 'Домашка',
  self_material: 'Материал себе',
  speech: 'Речь',
}
