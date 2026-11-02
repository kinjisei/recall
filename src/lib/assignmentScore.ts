// ============================================================================
// Описание: src/features/teacher/CLAUDE.md
// Балл работы по материалу — ЕДИНАЯ логика для экрана ученика, проверки,
// карточки материала, хаба «Заданий», диагностики и отчётов. Чистый модуль
// без импортов клиента БД: его гоняют scripts/test-assignment-score.mjs и
// test-match-score.mjs (node со стрипом типов).
//
// Правила:
//   1) счёт — в БАЛЛАХ (Ф2.25, журнал п.76 (8)): «Соедини пары» — балл за
//      каждую пару, остальные упражнения — 1. Так же считает сервер
//      (submit_material, миграция 0017): auto_score / auto_total — баллы;
//   2) вердикт учителя (teacher_review) приоритетнее авто-балла; у пар —
//      отметка у каждой пары (`pairs`), без неё — всё или ничего;
//   3) если ТЕКУЩАЯ попытка ещё не сдана (после переназначения answers/баллы
//      обнулены, история лежит в attempts[]) — берём ПОСЛЕДНЮЮ завершённую
//      попытку из attempts, иначе работа несправедливо выпадала из среднего.
//
// ⚠️ Свой счёт «filter(r => r.ok).length» рядом не заводить: до Ф2.25 их было
// семь, и с парами каждый показал бы своё «N из M».
// ============================================================================
import { matchVerdicts } from './text.ts'
import { plural } from '../shared/lib/plural.ts'
import type { AssignmentAnswer, AttemptSnapshot, MaterialAssignment, MaterialExercise, ReviewItem } from '../types'

/** Баллы: сколько набрано из скольких. */
export interface Points {
  got: number
  of: number
}

/** «6 баллов» — подпись счёта. */
export const points = (n: number) => `${n} ${plural(n, 'балл', 'балла', 'баллов')}`

/** Баллов за упражнение: «Соедини пары» — по паре, остальные — 1. */
export function exercisePoints(ex: MaterialExercise): number {
  return ex.type === 'match' ? ex.pairs.length : 1
}

/** Баллы ответа ученика по авто-проверке — как их посчитает сервер. */
export function answerPoints(ex: MaterialExercise, a: AssignmentAnswer | undefined): number {
  if (ex.type === 'match') return matchVerdicts(ex, a?.pairs).filter(Boolean).length
  return a?.auto_ok ? 1 : 0
}

/** Баллы по вердикту учителя или AI: у пар — отметка у каждой пары, без неё — всё или ничего. */
export function verdictPoints(ex: MaterialExercise, r: ReviewItem): number {
  if (ex.type !== 'match') return r.ok ? 1 : 0
  if (Array.isArray(r.pairs)) return ex.pairs.filter((_, i) => r.pairs?.[i] === true).length
  return r.ok ? ex.pairs.length : 0
}

/**
 * Вердикт по авто-проверке — черновик проверки, пока AI и учитель не сказали
 * своё: у пар — отметка у каждой пары (иначе «3 из 4» превратились бы в 0).
 */
export function autoVerdict(ex: MaterialExercise, a: AssignmentAnswer | undefined, index: number): ReviewItem {
  if (ex.type !== 'match') return { index, ok: a?.auto_ok ?? false, comment: '' }
  const pairs = matchVerdicts(ex, a?.pairs)
  return { index, ok: pairs.every(Boolean), comment: '', pairs }
}

/** «Правильно / Ошибка» упражнения целиком: у пар — все засчитаны или как у авто-проверки. */
export function markWhole(ex: MaterialExercise, a: AssignmentAnswer | undefined, ok: boolean): Partial<ReviewItem> {
  if (ex.type !== 'match') return { ok }
  return { ok, pairs: ok ? ex.pairs.map(() => true) : matchVerdicts(ex, a?.pairs) }
}

/** Баллы каждого упражнения: вердикт (если есть), иначе авто по ответу. */
export function exerciseScores(
  exercises: MaterialExercise[],
  answers: AssignmentAnswer[] | null | undefined,
  verdicts?: ReviewItem[] | null,
): Points[] {
  return exercises.map((ex, i) => {
    const r = verdicts?.find((v) => v.index === i)
    const got = r ? verdictPoints(ex, r) : answerPoints(ex, answers?.find((a) => a.index === i))
    return { got, of: exercisePoints(ex) }
  })
}

/**
 * Счёт работы «6 из 8 баллов»: по вердиктам (учителя или черновику AI), а где
 * вердикта нет — по авто-проверке ответов.
 */
export function workScore(
  exercises: MaterialExercise[],
  answers: AssignmentAnswer[] | null | undefined,
  verdicts?: ReviewItem[] | null,
): Points {
  return exerciseScores(exercises, answers, verdicts).reduce((s, p) => ({ got: s.got + p.got, of: s.of + p.of }), { got: 0, of: 0 })
}

export interface FinalScore {
  /** 0–100, null — ни одной завершённой попытки нет. */
  percent: number | null
  /** true — балл взят из прошлой попытки (текущая ещё не сдана). */
  fromAttempt: boolean
  /** Баллы по каждому упражнению той попытки, из которой взят балл (для разбивки по категориям). */
  verdicts: Map<number, Points>
}

type Attempt = {
  answers: MaterialAssignment['answers']
  auto_score: number | null
  auto_total: number | null
  teacher_review: ReviewItem[] | null
}

/** Балл одной попытки (текущей или из attempts): teacher_review > авто. */
function attemptPercent(a: Attempt, exercises: MaterialExercise[]): number | null {
  const tr = a.teacher_review
  if (tr && tr.length > 0) {
    // материал не виден (упражнений нет) — по вердиктам, по одному на упражнение
    const s = exercises.length ? workScore(exercises, a.answers, tr) : { got: tr.filter((r) => r.ok).length, of: tr.length }
    return s.of ? Math.round((s.got / s.of) * 100) : null
  }
  if (a.auto_score !== null && a.auto_total) {
    return Math.round((a.auto_score / a.auto_total) * 100)
  }
  return null
}

/** Баллы по каждому упражнению попытки: авто-оценка, поверх — учитель. */
function attemptVerdicts(a: Attempt, exercises: MaterialExercise[]): Map<number, Points> {
  const m = new Map<number, Points>()
  const answered = new Set((a.answers ?? []).map((x) => x.index))
  const reviewed = new Set((a.teacher_review ?? []).map((x) => x.index))
  exerciseScores(exercises, a.answers, a.teacher_review).forEach((p, i) => {
    if (answered.has(i) || reviewed.has(i)) m.set(i, p)
  })
  return m
}

/** Последняя завершённая (со сданными ответами) попытка из истории. */
function lastFinishedAttempt(attempts: AttemptSnapshot[] | null): AttemptSnapshot | null {
  for (let i = (attempts?.length ?? 0) - 1; i >= 0; i--) {
    const a = attempts?.[i]
    if (a?.submitted_at && (a.answers?.length || a.teacher_review?.length)) return a
  }
  return null
}

/**
 * Все сданные попытки работы с датой и финальным процентом (текущая +
 * история attempts) — сырьё для «Динамики за месяц» (lib/dynamics).
 */
export function scoreSamples(a: MaterialAssignment, exercises: MaterialExercise[]): { at: string; percent: number }[] {
  const out: { at: string; percent: number }[] = []
  if (a.submitted_at) {
    const p = attemptPercent(a, exercises)
    if (p !== null) out.push({ at: a.submitted_at, percent: p })
  }
  for (const att of a.attempts ?? []) {
    if (!att.submitted_at) continue
    const p = attemptPercent(att, exercises)
    if (p !== null) out.push({ at: att.submitted_at, percent: p })
  }
  return out
}

export function finalScore(a: MaterialAssignment, exercises: MaterialExercise[]): FinalScore {
  const current = attemptPercent(a, exercises)
  if (current !== null) {
    return { percent: current, fromAttempt: false, verdicts: attemptVerdicts(a, exercises) }
  }
  const prev = lastFinishedAttempt(a.attempts)
  if (prev) {
    const percent = attemptPercent(prev, exercises)
    if (percent !== null) {
      return { percent, fromAttempt: true, verdicts: attemptVerdicts(prev, exercises) }
    }
  }
  return { percent: null, fromAttempt: false, verdicts: new Map() }
}
