// ============================================================================
// Правка готового упражнения руками (Ф2.25-3, макет d17): форма по виду
// упражнения ⇄ упражнение материала. Форма — один «черновик» на все виды:
// вопрос, варианты и верный, ответ «вставь», предложение «собери», пары.
// Что вид не использует, остаётся пустым. Подписи и примеры полей — здесь
// же: их сверяет чистый тест (scripts/test-material-exercises.mjs).
//
// Чего нет в форме, правка бережёт: у «True / False» — строку текста, где
// это видно (`quote`, `mark`), у «Собери» — банк слов, пока предложение то
// же, у пар — подпись упражнения. Новое упражнение получает их по виду.
// ============================================================================
import { allowsNotGiven, TFNG_OPTIONS } from '../../lib/materialExercises.ts'
import { formatById, formatOf } from '../../lib/exerciseFormats.ts'
import type { AppLang, ExerciseFormatId, MaterialExercise } from '../../types/index.ts'

/** Поля формы правки — по ним же раскладываются причины отказа. */
export type EditField = 'prompt' | 'options' | 'answer' | 'text' | 'note' | 'pairs' | 'extra'

/** Форма правки одного упражнения (любого вида). */
export interface ExerciseDraft {
  format: ExerciseFormatId
  /** Вопрос, утверждение, предложение с ___, объяснение слова, перевод «собери». */
  prompt: string
  /** Варианты выбора («Выбери ответ», «Слово по объяснению», «Выбери форму»). */
  options: string[]
  /** Верный вариант или кнопка True / False; null — не отмечен. */
  answer: number | null
  /** «Вставь»: ответ (верных несколько — через «/»); «Собери»: предложение целиком. */
  text: string
  /** «Вставь»: подсказка; True / False: почему так. Необязательно. */
  note: string
  pairs: { left: string; right: string }[]
  /** «Соедини пары»: лишний вариант справа — не подходит ни к одному слову. */
  extra: string[]
}

/** Текст, к которому относится упражнение: язык и уровень задают кнопки True / False. */
export interface EditTarget {
  lang: AppLang
  level: string
}

/** Сколько вариантов у вида: «Выбери форму» — 3–4 (validExercises), остальные — 2–4. */
export function optionLimits(format: ExerciseFormatId): { min: number; max: number } {
  return format === 'form' ? { min: 3, max: 4 } : { min: 2, max: 4 }
}

/** Кнопки True / False у текста: на его языке, у A1–A2 — без «Not given». */
export const tfngButtons = (t: EditTarget): string[] => [...TFNG_OPTIONS[t.lang].slice(0, allowsNotGiven(t.level) ? 3 : 2)]

/** Слова «Собери предложение»: через пробелы. */
export const orderWords = (sentence: string): string[] => sentence.trim().split(/\s+/).filter(Boolean)

const EMPTY: Omit<ExerciseDraft, 'format'> = { prompt: '', options: [], answer: null, text: '', note: '', pairs: [], extra: [] }

/** Пустая форма после «Напишу сам» (d17-3б): варианты и пары — пустыми строками по нижнему пределу. */
export function blankDraft(format: ExerciseFormatId): ExerciseDraft {
  const f = formatById(format)
  if (f.type === 'mcq' && format !== 'tfng') return { ...EMPTY, format, options: Array(format === 'form' ? 3 : 4).fill('') }
  if (f.type === 'match') return { ...EMPTY, format, pairs: Array.from({ length: f.min }, () => ({ left: '', right: '' })) }
  return { ...EMPTY, format }
}

/** Упражнение → форма правки. */
export function toDraft(ex: MaterialExercise): ExerciseDraft {
  const format = formatOf(ex)
  if (ex.type === 'match') return { ...EMPTY, format, pairs: ex.pairs.map((p) => ({ ...p })), extra: [...(ex.extra ?? [])] }
  if (ex.type === 'mcq') {
    if (format === 'tfng') return { ...EMPTY, format, prompt: ex.prompt, answer: ex.answer, note: ex.why ?? '' }
    return { ...EMPTY, format, prompt: ex.prompt, options: [...ex.options], answer: ex.answer }
  }
  if (ex.type === 'fill') return { ...EMPTY, format, prompt: ex.prompt, text: ex.answer, note: ex.hint ?? '' }
  return { ...EMPTY, format, prompt: ex.prompt, text: ex.answer.join(' ') }
}

// строка без пробелов по краям; перенос строки в вопросе — пробел
const line = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim()

/**
 * Форма → упражнение материала. Проверки здесь нет — её делает
 * `checkEdit` (причины по полям, затем validExercises). `base` — прежнее
 * упражнение: из него берётся то, чего в форме нет.
 */
export function buildExercise(d: ExerciseDraft, t: EditTarget, base?: MaterialExercise): MaterialExercise {
  const f = formatById(d.format)
  const prompt = line(d.prompt)
  const note = line(d.note)
  if (f.type === 'match') {
    const extra = d.extra.map(line).filter(Boolean)
    const was = base?.type === 'match' && base.format === (d.format === 'match_definition' ? 'definition' : 'translation') ? base.prompt : ''
    return {
      kind: 'vocab',
      type: 'match',
      format: d.format === 'match_definition' ? 'definition' : 'translation',
      prompt: was || f.label,
      pairs: d.pairs.map((p) => ({ left: line(p.left), right: line(p.right) })),
      ...(extra.length ? { extra } : {}),
    }
  }
  if (d.format === 'tfng') {
    const options = tfngButtons(t)
    const answer = d.answer ?? -1
    // строка текста, где это видно, — с прежнего, пока ответ не «Not given» (у него строки нет)
    const old = base?.type === 'mcq' && base.format === 'tfng' && answer !== 2 ? base : null
    const quote = old?.quote ? { quote: old.quote, ...(old.mark ? { mark: old.mark } : {}) } : {}
    return { kind: 'comprehension', type: 'mcq', format: 'tfng', prompt, options, answer, ...quote, ...(note ? { why: note } : {}) }
  }
  if (f.type === 'mcq') {
    const options = d.options.map(line)
    const answer = d.answer ?? -1
    if (d.format === 'form') return { kind: 'grammar', type: 'mcq', format: 'form', prompt, options, answer }
    return { kind: f.kind, type: 'mcq', prompt, options, answer }
  }
  if (f.type === 'fill') return { kind: f.kind, type: 'fill', prompt, answer: line(d.text), ...(note ? { hint: note } : {}) }
  const answer = orderWords(d.text)
  // банк слов прежний, пока предложение то же; новое — по алфавиту (ученик всё равно перемешивает)
  const same = base?.type === 'order' && base.answer.join(' ') === answer.join(' ')
  const words = same ? [...base.words] : [...answer].sort((a, b) => a.localeCompare(b))
  return { kind: 'grammar', type: 'order', prompt, words, answer }
}

/** Подпись поля и пример внутри него. */
export interface FieldText {
  label: string
  placeholder: string
}

/** Поля формы вида (d17-1, d17-2, d17-3б): что показать и как подписать. */
export interface EditSpec {
  prompt?: FieldText
  /** Варианты: подпись, пример N-го, кнопка «+ вариант», пределы. */
  options?: { label: string; item: (n: number) => string; add: string; min: number; max: number }
  /** True / False: кнопки ответа. */
  buttons?: { label: string; items: string[] }
  text?: FieldText
  note?: FieldText
  pairs?: { label: string; left: string; right: string; add: string; min: number; max: number }
  extra?: FieldText
  /** Правило справа от «Готово» (d17-1 «Без верного варианта не сохранить»). */
  footnote: string
}

// примеры — на языке текста: рассказ кадров d17 и такой же испанский
const EXAMPLE: Record<AppLang, Record<'question' | 'statement' | 'gap' | 'form' | 'word' | 'definition' | 'answer' | 'sentence', string>> = {
  en: {
    question: 'Why did Dana wait near the gate?',
    statement: 'Dana came to the airport late.',
    gap: 'She ___ (buy) a coffee and waited near the gate.',
    form: 'Dana ___ to Istanbul last summer.',
    word: 'She ran with her ___ in her hand.',
    definition: 'the bags you take on a trip',
    answer: 'bought',
    sentence: 'Dana missed her flight',
  },
  es: {
    question: '¿Por qué esperó Dana en la puerta?',
    statement: 'Dana llegó tarde al aeropuerto.',
    gap: 'Ella ___ (comprar) un café.',
    form: 'Dana ___ a Estambul el verano pasado.',
    word: 'Corrió con la ___ en la mano.',
    definition: 'las bolsas que llevas en un viaje',
    answer: 'compró',
    sentence: 'Dana perdió su vuelo',
  },
}

const ex = (s: string) => `Например: ${s}`

export function editSpec(format: ExerciseFormatId, t: EditTarget): EditSpec {
  const e = EXAMPLE[t.lang]
  const opts = (label: string, noun: string, add: string) => ({ label, item: (n: number) => `${noun} ${n}`, add, ...optionLimits(format) })
  const pairs = { left: 'слово', add: 'пара', min: 3, max: 8 }
  const other = t.lang === 'es' ? 'испанском' : 'английском'
  switch (format) {
    case 'mcq':
      return { prompt: { label: 'Вопрос', placeholder: ex(e.question) }, options: opts('Варианты · кружок — верный', 'вариант', 'вариант'), footnote: 'Без верного варианта не сохранить' }
    case 'word_by_definition':
      return {
        prompt: { label: 'Объяснение · само слово не называть', placeholder: ex(e.definition) },
        options: opts('Слова · кружок — верное, из текста', 'слово', 'слово'),
        footnote: 'Без верного слова не сохранить',
      }
    case 'form':
      return { prompt: { label: 'Предложение с пропуском · ___', placeholder: ex(e.form) }, options: opts('Формы · 3–4, кружок — верная', 'форма', 'форма'), footnote: 'Без верной формы не сохранить' }
    case 'tfng':
      return {
        prompt: { label: 'Утверждение о тексте', placeholder: ex(e.statement) },
        buttons: { label: 'Ответ', items: tfngButtons(t) },
        note: { label: 'Почему так · необязательно', placeholder: 'Например: в тексте — she came early' },
        footnote: 'Без ответа не сохранить',
      }
    case 'fill_form':
    case 'fill_word':
      return {
        prompt: { label: 'Предложение с пропуском · ___', placeholder: ex(format === 'fill_word' ? e.word : e.gap) },
        text: { label: format === 'fill_word' ? 'Ответ · слово из текста' : 'Ответ · если верных несколько — через /', placeholder: format === 'fill_word' ? 'boarding pass' : e.answer },
        note: { label: 'Подсказка · необязательно', placeholder: format === 'fill_word' ? 'Например: посадочный талон' : 'Например: Past Simple от buy' },
        footnote: 'Без ответа не сохранить',
      }
    case 'order':
      return {
        prompt: { label: 'Перевод по-русски', placeholder: 'Например: Дана опоздала на рейс.' },
        text: { label: 'Предложение · слова через пробел', placeholder: e.sentence },
        footnote: 'Не меньше трёх слов',
      }
    case 'match_translation':
      return { pairs: { ...pairs, label: 'Пары · слово — перевод · 3–8', right: 'перевод' }, extra: { label: 'Лишний перевод · необязательно', placeholder: 'не подходит ни к одному слову' }, footnote: 'Пустую пару не сохранить' }
    case 'match_definition':
      return {
        pairs: { ...pairs, label: `Пары · слово — объяснение на ${other} · 3–8`, right: 'объяснение' },
        extra: { label: 'Лишнее объяснение · необязательно', placeholder: 'не подходит ни к одному слову' },
        footnote: 'Пустую пару не сохранить',
      }
  }
}
