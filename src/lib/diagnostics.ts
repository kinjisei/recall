// ============================================================================
// Диагностическая карта ученицы (для преподавателя): сводка сильных и слабых
// мест из РЕАЛЬНЫХ данных — слова (FSRS), задания по материалам (баллы и
// разбивка по типам упражнений), грамматические ошибки (таблица
// grammar_mistakes, синк из банка «Мои ошибки»), AI-квесты, активность.
// Все запросы идут под RLS преподавателя: чужих учениц не видно, отвязка
// отбирает доступ. Ничего не пишет в БД — только чтение.
// ============================================================================
import { supabase } from './supabase'
import { getStudentWords } from './wordChecks'
import { listStudentQuests } from './quests'
import { finalScore, scoreSamples } from './assignmentScore'
import { computeDynamics, type MonthDynamics } from './dynamics'
import type {
  AppLang,
  GrammarQuest,
  Material,
  MaterialAssignment,
  MaterialExerciseKind,
} from '../types'

/** Сводка по словам колоды (статусы — как в «Слова и перепроверка»). */
export interface DiagWords {
  total: number
  fresh: number // ещё не начатые
  learning: number
  learned: number
  /** Слова, где ученица чаще всего срывалась (lapses ≥ 2), хуже — выше. */
  struggling: { front: string; back: string | null; lapses: number }[]
}

/** Одно проверенное/сданное задание в карте. */
export interface DiagAssignment {
  id: string
  title: string
  lang: AppLang
  level: string
  submittedAt: string | null
  status: MaterialAssignment['status']
  /** Финальный процент: вердикт учителя, иначе авто-балл. null — ещё не сдано. */
  percent: number | null
  /** true — балл из прошлой попытки (материал переназначен и ещё не пересдан). */
  fromAttempt: boolean
}

/** Итог по категории упражнений (понимание/грамматика/лексика) за все работы. */
export type KindTotals = Record<MaterialExerciseKind, { ok: number; total: number }>

/** Ошибки грамматики, сгруппированные по теме урока. */
export interface DiagMistakeTopic {
  lang: AppLang
  topicId: number
  count: number
  lastAt: string
}

export interface StudentDiagnostics {
  words: DiagWords
  assignments: DiagAssignment[]
  /** Средний финальный процент по сданным работам (null — работ нет). */
  avgPercent: number | null
  kindTotals: KindTotals
  mistakes: DiagMistakeTopic[]
  /** false, если таблица grammar_mistakes ещё не создана (SQL не выполнен). */
  mistakesAvailable: boolean
  quests: GrammarQuest[]
  /** Дней с активностью за последние 14. */
  activeDays14: number
  /** Последний день занятий (YYYY-MM-DD) или null. */
  lastActiveDay: string | null
  /** «Сейчас vs 30 дней назад» — считается из тех же данных (lib/dynamics). */
  dynamics: MonthDynamics
}

/** YYYY-MM-DD в местном времени со сдвигом в днях. */
function localDay(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dd}`
}

export async function getStudentDiagnostics(studentId: string): Promise<StudentDiagnostics> {
  const [words, assignRes, mistakesRes, quests, activityRes] = await Promise.all([
    getStudentWords(studentId),
    supabase
      .from('material_assignments')
      .select('*, materials(*)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false }),
    supabase
      .from('grammar_mistakes')
      .select('lang, topic_id, created_at')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false }),
    listStudentQuests(studentId).catch(() => [] as GrammarQuest[]),
    supabase
      .from('activity_log')
      .select('day, type')
      .eq('user_id', studentId)
      .gte('day', localDay(-59)), // 60 дней: хватает и на «за 14», и на динамику
  ])

  // --- слова -----------------------------------------------------------
  const struggling = words
    .filter((w) => (w.state?.lapses ?? 0) >= 2)
    .sort((a, b) => (b.state?.lapses ?? 0) - (a.state?.lapses ?? 0))
    .slice(0, 6)
    .map((w) => ({
      front: w.card.front,
      back: w.card.back,
      lapses: w.state?.lapses ?? 0,
    }))
  const diagWords: DiagWords = {
    total: words.length,
    fresh: words.filter((w) => w.status === 'new').length,
    learning: words.filter((w) => w.status === 'learning').length,
    learned: words.filter((w) => w.status === 'learned').length,
    struggling,
  }

  // --- задания -----------------------------------------------------------
  if (assignRes.error) throw assignRes.error
  const rows = (assignRes.data ?? []) as (MaterialAssignment & { materials: Material | null })[]
  const kindTotals: KindTotals = {
    comprehension: { ok: 0, total: 0 },
    grammar: { ok: 0, total: 0 },
    vocab: { ok: 0, total: 0 },
  }
  const assignments: DiagAssignment[] = []
  for (const a of rows) {
    const mat = a.materials
    if (!mat) continue
    // единая логика балла (assignmentScore): переназначенные работы берут
    // последнюю завершённую попытку из attempts — не выпадают из среднего
    const score = finalScore(a)
    assignments.push({
      id: a.id,
      title: mat.title ?? mat.topic,
      lang: mat.lang,
      level: mat.level,
      submittedAt: a.submitted_at,
      status: a.status,
      percent: score.percent,
      fromAttempt: score.fromAttempt,
    })
    // разбивка по категориям — по вердиктам той же попытки, что дала балл
    score.verdicts.forEach((ok, index) => {
      const kind = mat.exercises[index]?.kind
      if (!kind || !(kind in kindTotals)) return
      kindTotals[kind].total++
      if (ok) kindTotals[kind].ok++
    })
  }
  const withScore = assignments.filter((a) => a.percent !== null)
  const avgPercent =
    withScore.length > 0
      ? Math.round(withScore.reduce((s, a) => s + (a.percent ?? 0), 0) / withScore.length)
      : null

  // --- грамматические ошибки ----------------------------------------------
  // Таблицы может ещё не быть (SQL-блок не выполнен) — карта не должна падать.
  let mistakes: DiagMistakeTopic[] = []
  let mistakesAvailable = true
  if (mistakesRes.error) {
    mistakesAvailable = false
  } else {
    const byTopic = new Map<string, DiagMistakeTopic>()
    for (const row of mistakesRes.data ?? []) {
      const lang = row.lang as AppLang
      const topicId = row.topic_id as number
      const k = `${lang}:${topicId}`
      const cur = byTopic.get(k)
      if (cur) {
        cur.count++
      } else {
        byTopic.set(k, { lang, topicId, count: 1, lastAt: row.created_at as string })
      }
    }
    mistakes = [...byTopic.values()].sort((a, b) => b.count - a.count).slice(0, 8)
  }

  // --- активность ----------------------------------------------------------
  if (activityRes.error) throw activityRes.error
  const activityRows = (activityRes.data ?? []) as { day: string; type: string }[]
  const days = [...new Set(activityRows.map((r) => r.day))].sort()
  const from14 = localDay(-13)

  // --- динамика «сейчас vs 30 дней назад» -----------------------------------
  const dynamics = computeDynamics({
    activityDays: days,
    perfectDays: [...new Set(activityRows.filter((r) => r.type === 'perfect').map((r) => r.day))],
    scoreSamples: rows.flatMap((a) => scoreSamples(a)),
    mistakeDates: mistakesAvailable
      ? (mistakesRes.data ?? []).map((r) => r.created_at as string)
      : [],
    cardCreatedDates: words.map((w) => w.card.created_at),
    learnedLastReviews: words
      .filter((w) => w.status === 'learned')
      .map((w) => w.state?.last_review ?? null),
  })

  return {
    words: diagWords,
    assignments: assignments.slice(0, 6),
    avgPercent,
    kindTotals,
    mistakes,
    mistakesAvailable,
    quests,
    activeDays14: days.filter((d) => d >= from14).length,
    lastActiveDay: days.length > 0 ? days[days.length - 1] : null,
    dynamics,
  }
}
