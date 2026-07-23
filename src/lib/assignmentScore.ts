// ============================================================================
// Финальный балл работы по материалу — ЕДИНАЯ логика для диагностики и любых
// отчётов. Чистый модуль без импортов клиента БД: его гоняет мини-тест
// scripts/test-assignment-score.mjs (node со стрипом типов).
//
// Правила:
//   1) вердикт учителя (teacher_review) приоритетнее авто-балла;
//   2) если ТЕКУЩАЯ попытка ещё не сдана (после переназначения answers/баллы
//      обнулены, история лежит в attempts[]) — берём ПОСЛЕДНЮЮ завершённую
//      попытку из attempts, иначе работа несправедливо выпадала из среднего.
// ============================================================================
import type { AttemptSnapshot, MaterialAssignment, ReviewItem } from '../types'

export interface FinalScore {
  /** 0–100, null — ни одной завершённой попытки нет. */
  percent: number | null
  /** true — балл взят из прошлой попытки (текущая ещё не сдана). */
  fromAttempt: boolean
  /** Вердикты той попытки, из которой взят балл (для разбивки по категориям). */
  verdicts: Map<number, boolean>
}

/** Балл одной попытки (текущей или из attempts): teacher_review > авто. */
function attemptPercent(a: {
  auto_score: number | null
  auto_total: number | null
  teacher_review: ReviewItem[] | null
}): number | null {
  const tr = a.teacher_review
  if (tr && tr.length > 0) {
    return Math.round((tr.filter((r) => r.ok).length / tr.length) * 100)
  }
  if (a.auto_score !== null && a.auto_total) {
    return Math.round((a.auto_score / a.auto_total) * 100)
  }
  return null
}

/** Вердикт по каждому упражнению попытки: авто-оценка, поверх — учитель. */
function attemptVerdicts(a: {
  answers: MaterialAssignment['answers']
  teacher_review: ReviewItem[] | null
}): Map<number, boolean> {
  const m = new Map<number, boolean>()
  for (const ans of a.answers ?? []) m.set(ans.index, ans.auto_ok)
  for (const r of a.teacher_review ?? []) m.set(r.index, r.ok)
  return m
}

/** Последняя завершённая (со сданными ответами) попытка из истории. */
function lastFinishedAttempt(attempts: AttemptSnapshot[] | null): AttemptSnapshot | null {
  for (let i = (attempts?.length ?? 0) - 1; i >= 0; i--) {
    const a = attempts![i]
    if (a.submitted_at && (a.answers?.length || a.teacher_review?.length)) return a
  }
  return null
}

/**
 * Все сданные попытки работы с датой и финальным процентом (текущая +
 * история attempts) — сырьё для «Динамики за месяц» (lib/dynamics).
 */
export function scoreSamples(a: MaterialAssignment): { at: string; percent: number }[] {
  const out: { at: string; percent: number }[] = []
  if (a.submitted_at) {
    const p = attemptPercent(a)
    if (p !== null) out.push({ at: a.submitted_at, percent: p })
  }
  for (const att of a.attempts ?? []) {
    if (!att.submitted_at) continue
    const p = attemptPercent(att)
    if (p !== null) out.push({ at: att.submitted_at, percent: p })
  }
  return out
}

export function finalScore(a: MaterialAssignment): FinalScore {
  const current = attemptPercent(a)
  if (current !== null) {
    return { percent: current, fromAttempt: false, verdicts: attemptVerdicts(a) }
  }
  const prev = lastFinishedAttempt(a.attempts)
  if (prev) {
    const percent = attemptPercent(prev)
    if (percent !== null) {
      return { percent, fromAttempt: true, verdicts: attemptVerdicts(prev) }
    }
  }
  return { percent: null, fromAttempt: false, verdicts: new Map() }
}
