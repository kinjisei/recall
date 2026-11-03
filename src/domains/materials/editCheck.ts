// ============================================================================
// Проверка правки упражнения (Ф2.25-3): причина отказа — у поля (кадр d17-1:
// «Отметь верный вариант» под вариантами), а не одна строка «не сохранить».
//
// Правка проходит ТОТ ЖЕ фильтр, что ответ AI (`normalizeExercises` →
// `validExercises`, lib/materialExercises): у ученика и на сервере не может
// оказаться упражнение, которое AI отсеяли бы. Причины по полям строже
// фильтра (пропуск ___ в предложении, слово в объяснении) и обязаны его
// покрывать: нет причин — упражнение проходит фильтр без изменений. Это
// держит scripts/test-material-exercises.mjs на всех видах.
// ============================================================================
import { MATCH_PAIRS, normalizeExercises, validExercises, type ExerciseContext } from '../../lib/materialExercises.ts'
import { normalizeChoice } from '../../lib/text.ts'
import { inText } from '../../lib/wordForms.ts'
import { formatById } from '../../lib/exerciseFormats.ts'
import type { ExerciseFormatId, MaterialExercise } from '../../types/index.ts'
import { buildExercise, optionLimits, orderWords, tfngButtons, type EditField, type ExerciseDraft } from './edit.ts'

export type EditProblems = Partial<Record<EditField, string>>

const CYRILLIC = /[а-яё]/i
const blank = (s: string) => s.trim().length === 0
const hasGap = (s: string) => /_{2,}/.test(s)
const EMPTY_PROMPT: Partial<Record<ExerciseFormatId, string>> = { mcq: 'Впиши вопрос', tfng: 'Впиши утверждение', word_by_definition: 'Впиши объяснение', order: 'Впиши перевод' }

/** Первый повтор в списке (как сверяет сервер — без регистра и знаков над буквами). */
function repeated(list: string[]): string | null {
  const seen = new Set<string>()
  for (const s of list) {
    const k = normalizeChoice(s)
    if (seen.has(k)) return s.trim()
    seen.add(k)
  }
  return null
}

const NOT_IN_TEXT = (w: string) => `Слова «${w.trim()}» нет в тексте — словарь только из текста`

/** Что «в тексте»: в любой форме и с разрывами (took ⇒ take, missed her flight ⇒ miss a flight). */
const seenIn = (ctx: ExerciseContext) => (w: string) => inText(ctx.body, w.trim(), ctx.lang, ctx.irregular)

function optionProblems(d: ExerciseDraft, ctx: ExerciseContext, out: EditProblems) {
  const { min, max } = optionLimits(d.format)
  const noun = d.format === 'form' ? 'формы' : d.format === 'word_by_definition' ? 'слова' : 'варианты'
  // верхний предел — только у формы (как в validExercises): старый вопрос AI с пятью вариантами сохраняется как есть
  if (d.options.some(blank)) out.options = `Заполни все ${noun} или убери пустой`
  else if (d.options.length < min || (d.format === 'form' && d.options.length > max)) out.options = d.format === 'form' ? 'Нужно 3–4 формы' : 'Нужно хотя бы 2 варианта'
  else {
    const twice = repeated(d.options)
    if (twice) out.options = `«${twice}» повторяется — у вопроса было бы два верных ответа`
  }
  const right = d.answer === null ? undefined : d.options[d.answer]
  if (right === undefined) {
    out.answer = d.format === 'form' ? 'Отметь верную форму' : d.format === 'word_by_definition' ? 'Отметь верное слово' : 'Отметь верный вариант'
  } else if (d.format === 'word_by_definition' && !out.options && !seenIn(ctx)(right)) {
    out.options = NOT_IN_TEXT(right)
  } else if (d.format === 'word_by_definition' && !blank(right) && !blank(d.prompt) && inText(d.prompt, right.trim(), ctx.lang, ctx.irregular)) {
    out.prompt = 'В объяснении — само слово: ученик увидит ответ'
  }
}

function pairProblems(d: ExerciseDraft, ctx: ExerciseContext, out: EditProblems) {
  const translation = d.format === 'match_translation'
  const lang = ctx.lang === 'es' ? 'испанском' : 'английском'
  const wrongScript = (s: string) => !blank(s) && CYRILLIC.test(s) !== translation
  const script = (s: string) => (translation ? `Перевод — по-русски: «${s.trim()}»` : `Объяснение — на ${lang}: «${s.trim()}»`)
  const rights = d.pairs.map((p) => p.right)
  const extra = d.extra.filter((s) => !blank(s))
  if (d.pairs.some((p) => blank(p.left) || blank(p.right))) out.pairs = 'Пустую пару не сохранить — заполни или убери'
  else if (d.pairs.length < MATCH_PAIRS.min || d.pairs.length > MATCH_PAIRS.max) out.pairs = `Нужно от ${MATCH_PAIRS.min} до ${MATCH_PAIRS.max} пар`
  else {
    const word = repeated(d.pairs.map((p) => p.left))
    const half = repeated(rights)
    const missing = d.pairs.find((p) => !seenIn(ctx)(p.left))
    const bad = rights.find(wrongScript)
    if (word) out.pairs = `Слово «${word}» повторяется`
    else if (half) out.pairs = `«${half}» повторяется — у двух слов один ответ`
    else if (missing) out.pairs = NOT_IN_TEXT(missing.left)
    else if (bad) out.pairs = script(bad)
  }
  const badExtra = extra.find(wrongScript)
  if (badExtra) out.extra = script(badExtra)
  else if (extra.length > 2) out.extra = 'Лишних вариантов — не больше двух'
  else if (extra.some((s) => rights.some((r) => normalizeChoice(r) === normalizeChoice(s))) || repeated(extra)) {
    out.extra = translation ? 'Такой перевод уже есть в парах — у слова было бы два ответа' : 'Такое объяснение уже есть в парах — у слова было бы два ответа'
  }
}

/** Причины отказа по полям; пусто — форму можно сохранять. */
export function exerciseProblems(d: ExerciseDraft, ctx: ExerciseContext): EditProblems {
  const out: EditProblems = {}
  const f = formatById(d.format)
  if (f.type === 'match') {
    pairProblems(d, ctx, out)
    return out
  }
  if (blank(d.prompt)) {
    out.prompt = EMPTY_PROMPT[d.format] ?? 'Впиши предложение'
  } else if ((f.type === 'fill' || d.format === 'form') && !hasGap(d.prompt)) {
    out.prompt = 'Отметь пропуск: ___'
  }
  if (d.format === 'tfng') {
    // кнопок у A1–A2 две: «Not given» с прежнего уровня — тоже «не отмечен»
    if (d.answer === null || d.answer < 0 || d.answer >= tfngButtons(ctx).length) out.answer = 'Отметь ответ'
  } else if (f.type === 'mcq') {
    optionProblems(d, ctx, out)
  } else if (f.type === 'fill') {
    const variants = d.text.split('/').filter((v) => !blank(v))
    if (variants.length === 0) out.text = 'Впиши ответ'
    else if (d.format === 'fill_word' && !variants.some(seenIn(ctx))) out.text = NOT_IN_TEXT(variants[0] ?? '')
  } else if (orderWords(d.text).length < 3) {
    out.text = blank(d.text) ? 'Впиши предложение' : 'Нужно хотя бы 3 слова'
  }
  return out
}

export type EditResult = { ok: true; exercise: MaterialExercise } | { ok: false; problems: EditProblems }

/**
 * «Готово»: причины по полям, затем тот же фильтр, что у ответа AI. Фильтр
 * отверг или поправил то, что прошло проверку полей, — значит, проверка
 * чего-то не знает: не сохраняем (тест держит, чтобы так не бывало).
 */
export function checkEdit(d: ExerciseDraft, ctx: ExerciseContext, base?: MaterialExercise): EditResult {
  const problems = exerciseProblems(d, ctx)
  if (Object.keys(problems).length) return { ok: false, problems }
  const exercise = buildExercise(d, ctx, base)
  const [kept] = validExercises(normalizeExercises([exercise], ctx))
  if (!kept || JSON.stringify(kept) !== JSON.stringify(exercise)) {
    return { ok: false, problems: { prompt: 'Упражнение не проходит проверку — поправь поля или нажми «Отмена»' } }
  }
  return { ok: true, exercise }
}
