// ============================================================================
// Подсказки-примеры в формах студии — на языке формы (PLAN.md Ф2.11б-3):
// материал, письменное задание, квест. Учителю испанского прежде подсказывали
// «mountain, tent, campfire» и «there is / there are».
// ============================================================================
import type { AppLang } from '../../types'

interface Hints {
  /** Слова для материала и письма. */
  words: string
  /** Грамматическая тема материала. */
  grammar: string
  /** Целевые слова эссе. */
  essayWords: string
  /** Целевая грамматика эссе. */
  essayGrammar: string
  /** Темы квеста: подсказка поля и список на выбор. */
  questTopics: string[]
}

export const FORM_HINTS: Record<AppLang, Hints> = {
  en: {
    words: 'mountain, river, forest',
    grammar: 'there is / there are',
    essayWords: 'journey, adventure, unforgettable',
    essayGrammar: 'Past Simple, used to',
    questTopics: [
      'Present Simple',
      'Past Simple',
      'Present Perfect',
      'Future (will / going to)',
      'Conditionals (if)',
      'Passive voice',
      'Modal verbs',
    ],
  },
  es: {
    words: 'montaña, río, bosque',
    grammar: 'hay / está',
    essayWords: 'viaje, aventura, inolvidable',
    essayGrammar: 'Pretérito Indefinido, Imperfecto',
    questTopics: [
      'Presente de indicativo',
      'Pretérito Indefinido',
      'Pretérito Imperfecto',
      'Indefinido vs Imperfecto',
      'Futuro simple',
      'Condicional',
      'Subjuntivo',
      'Ser vs Estar',
      'Por vs Para',
    ],
  },
}

/** Подсказка поля темы квеста: две первые темы списка. */
export const questTopicHint = (lang: AppLang): string => `${FORM_HINTS[lang].questTopics.slice(1, 3).join(', ')}…`
