// ============================================================================
// Сводка диагностики ученика для промптов AI.
//
// Живёт отдельно, потому что нужна ДВУМ местам: программе обучения
// (lib/studyPlan) и генерации заданий (lib/materials). Второй раз тот же текст
// не пишем — иначе через месяц у программы и у заданий будут разные
// представления об одном ученике, и разойдутся они молча.
// ============================================================================
import { type StudentDiagnostics } from './diagnostics'
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
