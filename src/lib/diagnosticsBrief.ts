// ============================================================================
// Описание: src/features/teacher/CLAUDE.md
// Сводка диагностики ученика для промптов AI.
//
// Живёт отдельно, потому что нужна ДВУМ местам: программе обучения
// (lib/studyPlan) и генерации заданий (lib/materials). Второй раз тот же текст
// не пишем — иначе через месяц у программы и у заданий будут разные
// представления об одном ученике, и разойдутся они молча.
// ============================================================================
import { getStudentDiagnostics, type StudentDiagnostics } from './diagnostics'
import type { AppLang, GrammarTopic } from '../types'

/** Каталог встроенных уроков грамматики: сами темы и их список строкой. */
export async function grammarCatalog(lang: AppLang): Promise<{ topics: GrammarTopic[]; text: string }> {
  const mod =
    lang === 'es' ? await import('../data/spanish/grammar') : await import('../data/english/grammar')
  const topics = mod.grammarTopics as GrammarTopic[]
  const text = topics.map((t) => `${t.id} · ${t.level} · ${t.title}`).join('\n')
  return { topics, text }
}

/**
 * Сводка диагностики для промпта (по-русски, коротко).
 * lang — язык программы: ошибки грамматики фильтруем по нему. У EN и ES свои
 * каталоги уроков, но topic_id в обоих начинаются с 0 и СОВПАДАЮТ по номерам;
 * без фильтра испанская ошибка №3 подставилась бы под английский урок №3, и AI
 * получил бы неверную слабую тему (двуязычный ученик).
 */
export function diagnosticsBrief(
  d: StudentDiagnostics,
  titles: Map<number, string>,
  lang: AppLang,
): string {
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
  const langMistakes = d.mistakes.filter((m) => m.lang === lang)
  if (langMistakes.length > 0) {
    lines.push(
      'Слабые темы грамматики (по ошибкам): ' +
        langMistakes
          .map((m) => `${titles.get(m.topicId) ?? `тема №${m.topicId}`} (ошибок ${m.count})`)
          .join(', ') +
        '.',
    )
  }
  lines.push(`Активность: ${d.activeDays14} дней из последних 14.`)
  return lines.join('\n')
}

/**
 * Готовый абзац для промпта: заголовок + сводка. Пустая строка, если ученик не
 * выбран или диагностика не поднялась — персонализация это усиление, а не
 * условие работы, и генерация обязана пройти в любом случае.
 *
 * ⚠️ Заголовок «Что известно про этого ученика» — тоже общий. Он живёт здесь, а
 * не у каждого зовущего: по нему смоуки отличают персонализированный промпт от
 * общего, и две разные формулировки означали бы, что одна из проверок молча
 * перестала что-либо проверять.
 */
export async function studentBriefBlock(
  studentId: string | null | undefined,
  lang: AppLang,
): Promise<string> {
  if (!studentId) return ''
  try {
    const [{ topics }, diag] = await Promise.all([
      grammarCatalog(lang),
      getStudentDiagnostics(studentId),
    ])
    const titles = new Map(topics.map((t) => [t.id, t.title]))
    const brief = diagnosticsBrief(diag, titles, lang)
    return brief ? `\nЧто известно про этого ученика (реальные данные приложения):\n${brief}` : ''
  } catch {
    return ''
  }
}

/**
 * Потолок сводки группы (PLAN.md Ф2.11б-3): промпт не растёт с числом
 * учеников — диагностика первых `students`, общих слов и тем не больше.
 */
export const GROUP_BRIEF_MAX = { students: 8, words: 10, topics: 5 }

/**
 * Сводка нескольких учеников для ОДНОГО материала: что буксует у нескольких
 * сразу — первым, с пометкой «у 2 из 3». Имён нет: AI они не нужны.
 */
export function groupDiagnosticsBrief(
  diags: StudentDiagnostics[],
  titles: Map<number, string>,
  lang: AppLang,
): string {
  const n = diags.length
  const words = new Map<string, { front: string; students: number; lapses: number }>()
  const topics = new Map<number, { students: number; count: number }>()
  const kinds: Record<string, { ok: number; total: number }> = {}
  for (const d of diags) {
    // у одного ученика слово одно (getStudentDiagnostics убирает дубли колод)
    for (const w of d.words.struggling) {
      const key = w.front.trim().toLowerCase()
      const cur = words.get(key) ?? { front: w.front, students: 0, lapses: 0 }
      words.set(key, { ...cur, students: cur.students + 1, lapses: cur.lapses + w.lapses })
    }
    for (const m of d.mistakes.filter((x) => x.lang === lang)) {
      const cur = topics.get(m.topicId) ?? { students: 0, count: 0 }
      topics.set(m.topicId, { students: cur.students + 1, count: cur.count + m.count })
    }
    for (const [k, v] of Object.entries(d.kindTotals)) {
      const cur = kinds[k] ?? { ok: 0, total: 0 }
      kinds[k] = { ok: cur.ok + v.ok, total: cur.total + v.total }
    }
  }
  const lines = [`Учеников: ${n}. Материал общий для всех.`]
  const topWords = [...words.values()]
    .sort((a, b) => b.students - a.students || b.lapses - a.lapses)
    .slice(0, GROUP_BRIEF_MAX.words)
  if (topWords.length > 0) {
    lines.push(`Буксующие слова: ${topWords.map((w) => `${w.front} (у ${w.students} из ${n})`).join(', ')}.`)
  }
  const topTopics = [...topics.entries()]
    .sort(([, a], [, b]) => b.students - a.students || b.count - a.count)
    .slice(0, GROUP_BRIEF_MAX.topics)
  if (topTopics.length > 0) {
    lines.push(
      'Слабые темы грамматики (по ошибкам): ' +
        topTopics
          .map(([id, t]) => `${titles.get(id) ?? `тема №${id}`} (у ${t.students} из ${n}, ошибок ${t.count})`)
          .join(', ') +
        '.',
    )
  }
  const label: Record<string, string> = { comprehension: 'понимание текста', grammar: 'грамматика', vocab: 'лексика' }
  const kindLine = Object.entries(kinds).filter(([, v]) => v.total > 0)
  if (kindLine.length > 0) {
    lines.push(`По категориям упражнений (все вместе): ${kindLine.map(([k, v]) => `${label[k] ?? k} ${v.ok}/${v.total}`).join(', ')}.`)
  }
  const days = diags.map((d) => d.activeDays14)
  lines.push(`Активность: от ${Math.min(...days)} до ${Math.max(...days)} дней из последних 14.`)
  return lines.join('\n')
}

/**
 * Абзац для промпта материала «для кого»: один ученик — его сводка (как
 * раньше), несколько — общая. Чья диагностика не поднялась — без неё; не
 * поднялась ни одна — пусто: персонализация усиливает, а не держит генерацию.
 */
export async function groupBriefBlock(studentIds: string[], lang: AppLang): Promise<string> {
  if (studentIds.length <= 1) return studentBriefBlock(studentIds[0], lang)
  try {
    const ids = studentIds.slice(0, GROUP_BRIEF_MAX.students)
    const [{ topics }, settled] = await Promise.all([
      grammarCatalog(lang),
      Promise.allSettled(ids.map((id) => getStudentDiagnostics(id))),
    ])
    const diags = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    if (diags.length === 0) return ''
    const titles = new Map(topics.map((t) => [t.id, t.title]))
    const brief = groupDiagnosticsBrief(diags, titles, lang)
    return `\nЧто известно про этих учеников (реальные данные приложения; что общее у нескольких — важнее):\n${brief}`
  } catch {
    return ''
  }
}
