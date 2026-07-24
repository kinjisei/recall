// ============================================================================
// Программа обучения по неделям: AI (tier max) составляет план под конкретную
// ученицу — берёт уровень, цель преподавателя и СЛАБЫЕ МЕСТА из диагностики
// (lib/diagnostics.ts), а темы грамматики выбирает ТОЛЬКО из встроенных уроков
// (id из каталога — чтобы пункты плана вели на реальные экраны приложения).
// Хранение — таблица study_plans (docs/schema.sql, блок «ПРОГРАММА ОБУЧЕНИЯ»).
// ============================================================================
import { supabase, requireUserId } from './supabase'
import { chat } from './gemini'
import { getStudentDiagnostics, type StudentDiagnostics } from './diagnostics'
import type { AppLang, GrammarTopic, PlanItem, PlanWeek, StudyPlan } from '../types'

export interface PlanRequest {
  studentId: string
  lang: AppLang
  level: string
  /** Число недель (2–8). */
  weeks: number
  /** Цель/пожелания преподавателя (свободный текст, можно пусто). */
  goal: string
}

export interface GeneratedPlan {
  summary: string
  weeks: PlanWeek[]
}

/** Достаёт JSON из ответа модели (терпит ```-обёртки и болтовню вокруг). */
function parseJson<T>(raw: string): T {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('AI вернул не-JSON. Попробуй ещё раз.')
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T
  } catch {
    throw new Error('AI вернул повреждённый JSON. Попробуй ещё раз.')
  }
}

/** Каталог уроков грамматики: «id · уровень · название» для промпта. */
async function grammarCatalog(lang: AppLang): Promise<{ topics: GrammarTopic[]; text: string }> {
  const mod =
    lang === 'es' ? await import('../data/spanish/grammar') : await import('../data/english/grammar')
  const topics = mod.grammarTopics as GrammarTopic[]
  const text = topics.map((t) => `${t.id} · ${t.level} · ${t.title}`).join('\n')
  return { topics, text }
}

/** Сводка диагностики для промпта (по-русски, коротко). */
function diagnosticsBrief(d: StudentDiagnostics, titles: Map<number, string>): string {
  const lines: string[] = []
  lines.push(
    `Слова: всего ${d.words.total} (учатся ${d.words.learning}, выучено ${d.words.learned}).`,
  )
  if (d.words.struggling.length > 0) {
    lines.push(
      `Буксующие слова: ${d.words.struggling.map((w) => `${w.front} (срывов ${w.lapses})`).join(', ')}.`,
    )
  }
  if (d.avgPercent !== null) lines.push(`Средний балл по заданиям: ${d.avgPercent}%.`)
  const kinds = Object.entries(d.kindTotals).filter(([, v]) => v.total > 0)
  if (kinds.length > 0) {
    const label: Record<string, string> = {
      comprehension: 'понимание текста',
      grammar: 'грамматика',
      vocab: 'лексика',
    }
    lines.push(
      'По категориям упражнений: ' +
        kinds.map(([k, v]) => `${label[k] ?? k} ${v.ok}/${v.total}`).join(', ') +
        '.',
    )
  }
  if (d.mistakes.length > 0) {
    lines.push(
      'Слабые темы грамматики (по ошибкам): ' +
        d.mistakes
          .map((m) => `${titles.get(m.topicId) ?? `тема №${m.topicId}`} (ошибок ${m.count})`)
          .join(', ') +
        '.',
    )
  }
  lines.push(`Активность: ${d.activeDays14} дней из последних 14.`)
  return lines.join('\n')
}

/** Санитизация ответа AI: валидные типы, существующие topicId, обрезка строк. */
function sanitize(weeks: PlanWeek[], requested: number, topicIds: Set<number>): PlanWeek[] {
  const validTypes = new Set(['grammar', 'words', 'reading', 'speech', 'dialog', 'custom'])
  const cut = (s: unknown, n: number) => String(s ?? '').slice(0, n)
  const out: PlanWeek[] = []
  for (const w of weeks.slice(0, requested)) {
    const items: PlanItem[] = []
    for (const it of (w.items ?? []).slice(0, 7)) {
      if (!it || !validTypes.has(it.type)) continue
      const item: PlanItem = {
        type: it.type,
        title: cut(it.title, 120),
        note: cut(it.note, 400),
      }
      // выдуманный topicId → пункт остаётся, но без ссылки на урок
      if (it.type === 'grammar' && typeof it.topicId === 'number' && topicIds.has(it.topicId)) {
        item.topicId = it.topicId
      }
      if (item.title) items.push(item)
    }
    if (items.length > 0) {
      out.push({ title: cut(w.title, 120), focus: cut(w.focus, 300), items })
    }
  }
  if (out.length === 0) throw new Error('AI вернул пустую программу. Попробуй ещё раз.')
  return out
}

/** Генерация программы (tier max). Диагностика подтягивается автоматически. */
export async function generateStudyPlan(
  req: PlanRequest,
  feedback?: string,
): Promise<GeneratedPlan> {
  const [{ topics, text: catalog }, diag] = await Promise.all([
    grammarCatalog(req.lang),
    getStudentDiagnostics(req.studentId),
  ])
  const titles = new Map(topics.map((t) => [t.id, t.title]))
  const langName = req.lang === 'es' ? 'испанский' : 'английский'

  const system = [
    'Ты — опытный методист по иностранным языкам в приложении Recall.',
    `Составь программу обучения на ${req.weeks} недель(и) для ученицы (${langName}, уровень ${req.level}).`,
    'Отвечай ТОЛЬКО валидным JSON без markdown и пояснений вокруг.',
    '',
    'Формат ответа:',
    '{',
    '  "summary": "по-русски, 2-4 предложения: логика программы — от чего к чему идём и почему",',
    '  "weeks": [',
    '    {',
    '      "title": "Неделя 1: короткое название",',
    '      "focus": "главный фокус недели, по-русски, 1 предложение",',
    '      "items": [',
    '        {"type":"grammar","topicId":ID_ИЗ_КАТАЛОГА,"title":"название темы","note":"что и зачем, по-русски"},',
    '        {"type":"words","title":"какая лексика","note":"сколько слов и как учить"},',
    '        {"type":"reading","title":"что читать","note":"..."},',
    '        {"type":"speech","title":"что тренировать в произношении","note":"..."},',
    '        {"type":"dialog","title":"тема разговора с AI","note":"..."},',
    '        {"type":"custom","title":"свободное задание","note":"..."}',
    '      ]',
    '    }',
    '  ]',
    '}',
    '',
    'Жёсткие правила:',
    `1. Недель — ровно ${req.weeks}. В каждой неделе 3-5 пунктов, РАЗНЫХ типов (не только грамматика).`,
    '2. topicId бери ТОЛЬКО из каталога уроков ниже — никаких выдуманных id. Тип "grammar" без подходящего урока в каталоге не используй (возьми "custom").',
    '3. Сначала закрой СЛАБЫЕ места из диагностики, потом двигайся к новому. От простого к сложному.',
    '4. Уровень тем — уровень ученицы или на шаг выше, не прыгай через голову.',
    '5. Все title и note — по-русски, коротко и конкретно (note — 1-2 предложения, без воды).',
    '',
    `Каталог уроков грамматики (id · уровень · название), ${langName}:`,
    catalog,
  ].join('\n')

  const userMsg = [
    `Цель/пожелания преподавателя: ${req.goal.trim() || 'не заданы — исходи из диагностики'}`,
    '',
    'Диагностика ученицы (реальные данные приложения):',
    diagnosticsBrief(diag, titles),
    feedback ? `\nПравки преподавателя к прошлой версии программы: ${feedback}` : '',
  ].join('\n')

  const raw = await chat([{ role: 'user', content: userMsg }], { system, task: 'program' })
  const parsed = parseJson<GeneratedPlan>(raw)
  if (!Array.isArray(parsed.weeks)) throw new Error('AI вернул неполную программу. Попробуй ещё раз.')
  return {
    summary: String(parsed.summary ?? '').slice(0, 1000),
    weeks: sanitize(parsed.weeks, req.weeks, new Set(topics.map((t) => t.id))),
  }
}

/**
 * Сохранить программу как активную. Архив прежней и вставка новой — ОДНОЙ
 * транзакцией (RPC replace_study_plan): раньше сбой между двумя запросами
 * оставлял ученицу вообще без активной программы (находка ревью 2026-07-24).
 */
export async function saveStudyPlan(req: PlanRequest, plan: GeneratedPlan): Promise<void> {
  const { error } = await supabase.rpc('replace_study_plan', {
    p_student_id: req.studentId,
    p_lang: req.lang,
    p_level: req.level,
    p_goal: req.goal,
    p_summary: plan.summary,
    p_weeks: plan.weeks,
  })
  if (error) throw new Error(error.message)
}

/** Активная программа пары (для экрана преподавателя). */
export async function getActivePlan(studentId: string, lang: AppLang): Promise<StudyPlan | null> {
  const teacherId = await requireUserId()
  const { data, error } = await supabase
    .from('study_plans')
    .select('*')
    .match({ teacher_id: teacherId, student_id: studentId, lang, status: 'active' })
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as StudyPlan) ?? null
}

/** Снять программу (в архив). */
export async function archivePlan(id: string): Promise<void> {
  const { error } = await supabase.from('study_plans').update({ status: 'archived' }).eq('id', id)
  if (error) throw new Error(error.message)
}

/** Активные программы текущей ученицы (для «Учёбы» и /program). */
export async function getMyPlans(): Promise<StudyPlan[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('study_plans')
    .select('*')
    .eq('student_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as StudyPlan[]
}

/** Номер текущей недели программы: 1-based, обрезан границами плана. */
export function currentWeekIndex(plan: StudyPlan): number {
  const start = new Date(plan.start_day + 'T00:00:00')
  const diffDays = Math.floor((Date.now() - start.getTime()) / 86400000)
  const week = Math.floor(diffDays / 7) + 1
  return Math.min(Math.max(week, 1), plan.weeks.length)
}
