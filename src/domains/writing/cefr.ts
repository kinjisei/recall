// ============================================================================
// Шкала CEFR для письма — сжатый пересказ «Written assessment criteria grid»
// (Council of Europe, Manual for relating examinations to the CEFR, табл. C4;
// Companion Volume 2020 — Written production, Coherence, Accuracy, Range).
// Для обычного эссе (не IELTS) на любом языке приложения: уровни не зависят
// от языка. Модель ставит уровень каждой стороне текста — высший, описанию
// которого текст соответствует ПОЛНОСТЬЮ, — общий уровень считает
// `examiner.ts` (журнал п.77).
// ============================================================================

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]
export type AspectKey = 'task' | 'range' | 'accuracy' | 'coherence'

export const ASPECTS: readonly { key: AspectKey; label: string }[] = [
  { key: 'task', label: 'Задание' },
  { key: 'range', label: 'Словарь' },
  { key: 'accuracy', label: 'Точность' },
  { key: 'coherence', label: 'Связность' },
]

const GRID: Record<AspectKey, Record<CefrLevel, string>> = {
  task: {
    A1: 'Simple isolated phrases and sentences about the topic.',
    A2: 'A series of simple phrases and sentences on the topic; covers the basic points of the task.',
    B1: 'Straightforward connected text; covers all points of the task; can narrate, describe and give simple reasons or opinions.',
    B2: 'Clear, detailed text; covers all points and develops them, giving reasons, supporting details and examples.',
    C1: 'Clear, well-structured text that expands and supports points at length with subsidiary points, reasons and examples, and rounds off with an appropriate conclusion.',
    C2: 'Clear, smoothly flowing, complex text in an appropriate and effective style; a logical structure that helps the reader find significant points.',
  },
  range: {
    A1: 'A very basic repertoire of words and simple phrases about personal details and concrete situations.',
    A2: 'Basic sentence patterns with memorised phrases; vocabulary for everyday needs only.',
    B1: 'Enough language to get by on familiar topics, with some circumlocution; frequently used patterns.',
    B2: 'Enough range to describe clearly and express viewpoints without much searching for words; some complex sentence forms; varies formulation to avoid repetition.',
    C1: 'A broad range: chooses a suitable formulation to say exactly what is meant; idiomatic expressions and collocations.',
    C2: 'A very wide range with precision and nuance; no sign of having to restrict what is said.',
  },
  accuracy: {
    A1: 'Limited control of a few simple structures and memorised patterns.',
    A2: 'Uses some simple structures correctly but still systematically makes basic mistakes (mixes tenses, forgets agreement); the meaning is usually clear.',
    B1: 'Reasonably accurate with frequently used patterns; errors occur, but it is clear what the writer wants to say.',
    B2: 'A relatively high degree of grammatical control; no errors that cause misunderstanding; slips mainly in complex structures.',
    C1: 'Consistently high grammatical accuracy; errors are rare and difficult to spot.',
    C2: 'Consistent grammatical control of complex language.',
  },
  coherence: {
    A1: 'Links words or groups of words with very basic connectors (and, then).',
    A2: 'Links groups of words with simple connectors (and, but, because).',
    B1: 'Links a series of shorter elements into a connected, linear sequence of points.',
    B2: 'Uses a limited number of cohesive devices to link sentences into clear, coherent text with paragraphs; may be some “jumpiness” in a long text.',
    C1: 'Clear, smoothly flowing, well-structured text; controlled use of organisational patterns, connectors and cohesive devices.',
    C2: 'Coherent and cohesive text using a full and appropriate range of organisational patterns.',
  },
}

export function cefrScale(): string {
  return ASPECTS.map(
    ({ key }) => `${key.toUpperCase()} (key: ${key})\n${CEFR_LEVELS.map((l) => `${l}: ${GRID[key][l]}`).join('\n')}`,
  ).join('\n\n')
}
