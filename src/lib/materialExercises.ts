// ============================================================================
// Описание: src/features/teacher/CLAUDE.md
// Отбор упражнений из ответа модели — единственный фильтр между свободным
// текстом AI и тем, что увидит ученик.
//
// Вынесено отдельным ЧИСТЫМ модулем (без supabase и сети) ровно затем, чтобы
// его можно было проверить юнит-тестом: scripts/test-material-exercises.mjs.
// Тот же приём, что у dailyPlanCore и distractors.
// ============================================================================
import { normalizeChoice } from './text.ts'
import { inText, type IrregularForms } from './wordForms.ts'
import type { AppLang, MaterialExercise } from '../types'

/** «Соедини пары»: 3–8 пар (журнал п.76 (8)); лишних справа — не больше двух. */
export const MATCH_PAIRS = { min: 3, max: 8 } as const
const MATCH_EXTRA_MAX = 2

const filled = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

/** Кнопки «Верно / Неверно / Не сказано» — на языке текста (журнал п.76 (18)). */
export const TFNG_OPTIONS: Record<AppLang, readonly [string, string, string]> = {
  en: ['True', 'False', 'Not given'],
  es: ['Verdadero', 'Falso', 'No se dice'],
}

/** «Не сказано» — с B1: у текста A1–A2 только «Верно / Неверно» (журнал п.76 (8)). */
export const allowsNotGiven = (level: string): boolean => !/^A[12]$/i.test(level.trim())

// какую кнопку модель имела в виду: подпись на любом из языков
const TFNG_LABELS: ReadonlyArray<ReadonlySet<string>> = [
  new Set(['true', 'verdadero', 'верно', 'yes', 'sí', 'si']),
  new Set(['false', 'falso', 'неверно', 'no']),
  new Set(['not given', 'no se dice', 'не сказано', 'no se menciona', 'not stated', 'ng']),
]
const tfngClass = (label: unknown): number => TFNG_LABELS.findIndex((s) => typeof label === 'string' && s.has(label.trim().toLowerCase()))

const CYRILLIC = /[а-яё]/i

/** Текст материала, к которому приводятся упражнения. */
export interface ExerciseContext {
  body: string
  lang: AppLang
  /** CEFR текста: у A1–A2 — без «Не сказано». */
  level: string
  /** Неправильные формы (`lib/wordForms` `loadIrregular`): took ⇒ take. */
  irregular?: IrregularForms
}

/**
 * Ответ модели → упражнения нашего вида (Ф2.25-1б), до `validExercises`:
 * • «Верно / Неверно»: кнопки — на языке текста, у A1–A2 — две (ответ «Не
 *   сказано» у такого текста — упражнение выбрасывается), ответ — по
 *   подписи, а не по месту: модель путает порядок;
 * • словарное — только слова, которые есть в тексте (в любой форме):
 *   пары без такого слова убираются, «слово по объяснению» и «вставь слово»
 *   без него — выбрасываются;
 * • «Соедини слово и перевод» — перевод по-русски, «… и объяснение» —
 *   объяснение на языке текста: перепутанные — выбрасываются.
 */
export function normalizeExercises(list: MaterialExercise[], ctx: ExerciseContext): MaterialExercise[] {
  const seen = (word: string) => inText(ctx.body, word, ctx.lang, ctx.irregular)
  return (list ?? []).flatMap((e): MaterialExercise[] => {
    if (!e || typeof e !== 'object') return [e]
    if (e.type === 'mcq' && e.format === 'tfng') {
      const right = tfngClass(e.options?.[e.answer])
      const three = allowsNotGiven(ctx.level)
      if (right < 0 || (right === 2 && !three)) return []
      return [{ ...e, options: [...TFNG_OPTIONS[ctx.lang].slice(0, three ? 3 : 2)], answer: right }]
    }
    if (e.type === 'match') {
      if (!Array.isArray(e.pairs)) return [e]
      const translation = e.format === 'translation'
      const rights = [...e.pairs.map((p) => p?.right), ...(e.extra ?? [])]
      if (rights.some((r) => filled(r) && CYRILLIC.test(r) !== translation)) return []
      return [{ ...e, pairs: e.pairs.filter((p) => p && filled(p.left) && seen(p.left)) }]
    }
    if (e.kind === 'vocab' && e.type === 'mcq' && !e.format) return seen(e.options?.[e.answer] ?? '') ? [e] : []
    if (e.kind === 'vocab' && e.type === 'fill') return String(e.answer ?? '').split('/').some((a) => seen(a)) ? [e] : []
    return [e]
  })
}

/**
 * Строки разные и после сверки выбора: сервер сравнивает ТЕКСТ выбранного
 * (`norm_answer`), и два одинаковых варианта засчитали бы неверный двойник.
 */
function distinct(list: string[]): boolean {
  return new Set(list.map(normalizeChoice)).size === list.length
}

/**
 * Валидные упражнения из ответа AI (общая для генерации текста и «Мой текст»).
 * Экспортируется ради юнит-проверки: scripts/test-material-exercises.mjs.
 */
export function validExercises(list: MaterialExercise[]): MaterialExercise[] {
  return (list ?? []).filter((e) => {
    if (!e || typeof e !== 'object') return false
    if (e.type === 'mcq') {
      if (
        typeof e.prompt !== 'string' ||
        !Array.isArray(e.options) ||
        !e.options.every(filled) ||
        !distinct(e.options) ||
        typeof e.answer !== 'number' ||
        e.answer < 0 ||
        e.answer >= e.options.length
      ) {
        return false
      }
      // «Верно / Неверно (/ Не сказано)» — 2–3 кнопки; «Выбери форму» — 3–4 формы
      if (e.format === 'tfng') return e.options.length <= 3 && e.options.length >= 2
      if (e.format === 'form') return e.options.length >= 3 && e.options.length <= 4
      return e.options.length >= 2
    }
    if (e.type === 'match') {
      if (e.format !== 'translation' && e.format !== 'definition') return false
      if (typeof e.prompt !== 'string' || !Array.isArray(e.pairs)) return false
      if (e.pairs.length < MATCH_PAIRS.min || e.pairs.length > MATCH_PAIRS.max) return false
      if (!e.pairs.every((p) => p && filled(p.left) && filled(p.right))) return false
      const extra = e.extra ?? []
      if (!Array.isArray(extra) || extra.length > MATCH_EXTRA_MAX || !extra.every(filled)) return false
      // слева — разные слова; справа — разные половины, и лишний вариант не
      // совпадает ни с одной: иначе у слова два «верных» ответа
      return distinct(e.pairs.map((p) => p.left)) && distinct([...e.pairs.map((p) => p.right), ...extra])
    }
    if (e.type === 'fill') {
      return typeof e.prompt === 'string' && typeof e.answer === 'string' && e.answer.length > 0
    }
    if (e.type === 'order') {
      // ⚠️ Мало проверить, что массивы на месте: если words и answer не
      // совпадают по составу, упражнение НЕВОЗМОЖНО собрать — ученик перебирает
      // слова и не может дойти до верного ответа. Сверяем мультимножества.
      if (
        typeof e.prompt !== 'string' ||
        !Array.isArray(e.words) ||
        !Array.isArray(e.answer) ||
        e.answer.length < 3 ||
        e.words.length !== e.answer.length
      ) {
        return false
      }
      const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()
      const bank = e.words.map(norm).sort()
      const right = e.answer.map(norm).sort()
      return bank.every((w, i) => w.length > 0 && w === right[i])
    }
    return false
  })
}
