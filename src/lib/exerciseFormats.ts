// ============================================================================
// Описание: src/features/teacher/CLAUDE.md
// Каталог видов упражнений материала (Ф2.25-2, макет d16): группа («По
// тексту», «Словарь», «Грамматика»), название, что делает ученик, тип
// упражнения и пределы. Его читают план (учитель выбирает виды без
// генерации), промпты (текст делает ровно выбранное), проверка работы и
// печать (названия) и сверка «AI сделал не всё по плану».
//
// Пределы (журнал п.76 (8)): видов в плане — до 8, заданий одного вида — до
// 10, у «Соедини пары» — одно упражнение на 3–8 пар (балл за пару).
// Чистый модуль: держит scripts/test-exercise-formats.mjs.
// ============================================================================
import { plural } from '../shared/lib/plural.ts'
import type { AppLang, ExerciseFormatId, MaterialExercise, MaterialExerciseKind, PlanExercise } from '../types'

export type FormatGroupId = 'text' | 'vocab' | 'grammar'

export interface FormatGroup {
  id: FormatGroupId
  /** «По тексту» — подпись строки плана. */
  label: string
  /** «вопросы по смыслу текста» — под заголовком группы в выборе видов (d16-2). */
  note: string
}

export const GROUPS: readonly FormatGroup[] = [
  { id: 'text', label: 'По тексту', note: 'вопросы по смыслу текста' },
  { id: 'vocab', label: 'Словарь', note: 'только слова из текста' },
  { id: 'grammar', label: 'Грамматика', note: 'конструкции из текста' },
]

export interface ExerciseFormat {
  id: ExerciseFormatId
  group: FormatGroupId
  kind: MaterialExerciseKind
  /** Тип упражнения в материале: выбор, вписать, собрать, пары. */
  type: 'mcq' | 'fill' | 'order' | 'match'
  label: string
  /** Что делает ученик — строка в выборе видов (d16-2) и под названием в плане. */
  does: string
  /** Единица счёта в плане: «3 вопр.», «3 утв.», «5 пар», «4 зад.». */
  unit: string
  min: number
  max: number
  /** Сколько ставится, когда учитель добавил вид. */
  def: number
}

/** Видов в плане — не больше. */
export const MAX_ROWS = 8

export const FORMATS: readonly ExerciseFormat[] = [
  { id: 'mcq', group: 'text', kind: 'comprehension', type: 'mcq', label: 'Выбери ответ', does: 'вопрос по смыслу, 4 варианта', unit: 'вопр.', min: 1, max: 10, def: 3 },
  { id: 'tfng', group: 'text', kind: 'comprehension', type: 'mcq', label: 'True / False / Not given', does: 'утверждение о тексте', unit: 'утв.', min: 1, max: 10, def: 3 },
  { id: 'match_translation', group: 'vocab', kind: 'vocab', type: 'match', label: 'Соедини слово и перевод', does: 'слово ↔ перевод на русский', unit: 'пар', min: 3, max: 8, def: 5 },
  { id: 'match_definition', group: 'vocab', kind: 'vocab', type: 'match', label: 'Соедини слово и объяснение', does: 'слово ↔ объяснение', unit: 'пар', min: 3, max: 8, def: 5 },
  { id: 'word_by_definition', group: 'vocab', kind: 'vocab', type: 'mcq', label: 'Слово по объяснению', does: 'выбрать слово из 4', unit: 'зад.', min: 1, max: 10, def: 3 },
  { id: 'fill_word', group: 'vocab', kind: 'vocab', type: 'fill', label: 'Вставь слово из текста', does: 'вписать слово в предложение', unit: 'зад.', min: 1, max: 10, def: 3 },
  { id: 'fill_form', group: 'grammar', kind: 'grammar', type: 'fill', label: 'Вставь форму', does: 'вписать форму', unit: 'зад.', min: 1, max: 10, def: 4 },
  { id: 'order', group: 'grammar', kind: 'grammar', type: 'order', label: 'Собери предложение', does: 'из слов', unit: 'зад.', min: 1, max: 10, def: 2 },
  { id: 'form', group: 'grammar', kind: 'grammar', type: 'mcq', label: 'Выбери правильную форму', does: 'из 3–4 форм', unit: 'зад.', min: 1, max: 10, def: 3 },
]

const BY_ID = new Map(FORMATS.map((f) => [f.id, f]))

export const formatById = (id: ExerciseFormatId): ExerciseFormat => BY_ID.get(id) ?? FORMATS[0]!

/** У текста A1–A2 у True / False нет «Not given» (журнал п.76 (8)). */
const lowLevel = (level: string) => /^A[12]$/i.test(level.trim())

/** Название вида с поправкой на уровень: у A1–A2 — «True / False». */
export const formatTitle = (f: ExerciseFormat, level: string): string => (f.id === 'tfng' && lowLevel(level) ? 'True / False' : f.label)

/** Что делает ученик — с языком текста у объяснений (d16-2). */
export function formatDoes(f: ExerciseFormat, lang: AppLang, level?: string): string {
  if (f.id === 'match_definition') return `слово ↔ объяснение на ${lang === 'es' ? 'испанском' : 'английском'}, уровня текста`
  if (f.id === 'tfng') return level && lowLevel(level) ? `утверждение о тексте; для ${level.toUpperCase()} — две кнопки` : 'утверждение о тексте; три кнопки'
  return f.does
}

/** Вид готового упражнения. */
export function formatOf(ex: MaterialExercise): ExerciseFormatId {
  if (ex.type === 'match') return ex.format === 'definition' ? 'match_definition' : 'match_translation'
  if (ex.type === 'mcq') {
    if (ex.format === 'tfng') return 'tfng'
    if (ex.format === 'form') return 'form'
    return ex.kind === 'vocab' ? 'word_by_definition' : ex.kind === 'grammar' ? 'form' : 'mcq'
  }
  if (ex.type === 'fill') return ex.kind === 'vocab' ? 'fill_word' : 'fill_form'
  return 'order'
}

// вид строки плана до Ф2.25-2 (и у модели, если `format` не прислала): по kind и type
const LEGACY: Record<string, ExerciseFormatId> = {
  'comprehension/mcq': 'mcq',
  'comprehension/tfng': 'tfng',
  'vocab/mcq': 'word_by_definition',
  'vocab/fill': 'fill_word',
  'vocab/match': 'match_translation',
  'vocab/match_translation': 'match_translation',
  'vocab/match_definition': 'match_definition',
  'grammar/fill': 'fill_form',
  'grammar/order': 'order',
  'grammar/form': 'form',
  'grammar/mcq': 'form',
}

/** Вид строки плана: `format`, а у старых планов — по kind и type. */
export function rowFormat(p: Pick<PlanExercise, 'kind' | 'type' | 'format'>): ExerciseFormatId | null {
  if (p.format && BY_ID.has(p.format)) return p.format
  return LEGACY[`${p.kind}/${p.type}`] ?? (BY_ID.has(p.type as ExerciseFormatId) ? (p.type as ExerciseFormatId) : null)
}

const clamp = (n: number, f: ExerciseFormat) => Math.min(f.max, Math.max(f.min, Math.round(Number.isFinite(n) ? n : f.def)))

/** Новая строка плана: учитель добавил вид (пар — по числу целевых слов, в пределах 3–8). */
export function newRow(id: ExerciseFormatId, words = 0): PlanExercise {
  const f = formatById(id)
  const count = f.type === 'match' && words > 0 ? clamp(words, f) : f.def
  return { format: id, kind: f.kind, type: f.type, count, note: '' }
}

/**
 * План к виду каталога: у каждой строки — вид, kind и type из каталога,
 * количество в пределах; неизвестный вид — выбрасывается, повтор вида —
 * сливается в первую строку, строк — не больше 8.
 */
export function normalizeRows(rows: readonly PlanExercise[] | null | undefined): PlanExercise[] {
  const out: PlanExercise[] = []
  for (const p of rows ?? []) {
    if (!p || typeof p !== 'object') continue
    const id = rowFormat(p)
    if (!id || out.some((r) => r.format === id)) continue
    const f = formatById(id)
    const row: PlanExercise = { format: id, kind: f.kind, type: f.type, count: clamp(Number(p.count), f), note: typeof p.note === 'string' ? p.note : '' }
    if (id === 'tfng' && p.tricky) row.tricky = true
    out.push(row)
    if (out.length === MAX_ROWS) break
  }
  return out
}

/** Упражнения «Моего текста» до выбора учителя (кадр d16-3): вопросы, True / False, пары, форма. */
export const OWN_TEXT_ROWS: readonly PlanExercise[] = [newRow('mcq'), { ...newRow('tfng'), tricky: true }, newRow('match_translation'), newRow('fill_form')]

/** Откуда слова и грамматика строки: план от AI или заявка «Моего текста». */
export interface RowContext {
  level: string
  /** Целевые слова: плана — или «Слова для акцента» заявки «Моего текста». */
  words: readonly string[]
  /** Грамматика: тема плана — или «Акцент на грамматике». */
  grammar: string
  /** Тема грамматики названа в заявке (а не придумана AI). */
  grammarAsked: boolean
  /** «Мой текст»: плана нет, слова и грамматика — из заявки. */
  own?: boolean
}

/**
 * Подпись под названием вида в строке плана (d16-1, d16-3, d16-4): что
 * именно возьмёт AI — слова пар, тема грамматики, две кнопки у A2.
 */
export function rowNote(p: PlanExercise, ctx: RowContext): string {
  const id = rowFormat(p)
  if (!id) return ''
  const f = formatById(id)
  if (id === 'tfng') return lowLevel(ctx.level) ? `для ${ctx.level.toUpperCase()} — без «Not given»` : 'утверждение о тексте'
  if (f.type === 'match') {
    const n = p.count
    const w = ctx.words
    if (!w.length) return `AI выберет ${n} ${plural(n, 'слово', 'слова', 'слов')} из текста`
    const from = ctx.own ? 'слова из заявки' : 'слова из текста'
    if (n <= w.length) return `${from}: ${w.slice(0, n).join(', ')}`
    const more = `${n - w.length} из текста`
    return ctx.own ? `${from}: ${w.join(', ')} + ${more}` : `${w.length} ${plural(w.length, 'целевое слово', 'целевых слова', 'целевых слов')} + ${more}`
  }
  const g = ctx.grammar.trim()
  if (f.kind === 'grammar' && g) return ctx.grammarAsked ? `${g} — из заявки${ctx.own ? '' : ', есть в тексте'}` : `${g} — есть в тексте`
  return f.does
}

/** «4 вида» и «11 заданий · до 15 баллов» — шапка блока, итог и полоса внизу (d16). */
export function totalsText(rows: readonly PlanExercise[]): { kinds: string; tasks: string; points: string } {
  const t = planTotals(rows)
  return {
    kinds: `${t.kinds} ${plural(t.kinds, 'вид', 'вида', 'видов')}`,
    tasks: `${t.tasks} ${plural(t.tasks, 'задание', 'задания', 'заданий')}`,
    points: `до ${t.points} ${plural(t.points, 'балла', 'баллов', 'баллов')}`,
  }
}

/** Сколько получится: видов, заданий (пары — одно задание) и баллов (пары — по паре). */
export function planTotals(rows: readonly PlanExercise[]): { kinds: number; tasks: number; points: number } {
  let tasks = 0
  let points = 0
  for (const p of rows) {
    const id = rowFormat(p)
    const pairs = id ? formatById(id).type === 'match' : false
    tasks += pairs ? 1 : p.count
    points += p.count
  }
  return { kinds: rows.length, tasks, points }
}

export interface Shortfall {
  label: string
  want: number
  got: number
  unit: string
}

/**
 * Что AI сделал не по плану (Ф2.25-2 (6)): у вида упражнений меньше, чем
 * просили (у пар — пар), — учитель видит это, а не получает молча меньше.
 */
export function planShortfall(rows: readonly PlanExercise[], exercises: readonly MaterialExercise[], level = ''): Shortfall[] {
  const out: Shortfall[] = []
  for (const p of rows) {
    const id = rowFormat(p)
    if (!id) continue
    const f = formatById(id)
    const mine = exercises.filter((e) => formatOf(e) === id)
    const got = f.type === 'match' ? Math.max(0, ...mine.map((e) => (e.type === 'match' ? e.pairs.length : 0))) : mine.length
    if (got < p.count) out.push({ label: formatTitle(f, level), want: p.count, got, unit: f.unit })
  }
  return out
}

/** Полное название вида: шапка упражнения в проверке и печать. */
export function formatLabel(ex: MaterialExercise): string {
  const id = formatOf(ex)
  if (id === 'tfng' && ex.type === 'mcq') return ex.options.length > 2 ? 'True / False / Not given' : 'True / False'
  return formatById(id).label
}

/** Короткое название — строка итога проверки (d18: «Соедини пары», «True / False»). */
export function shortLabel(ex: MaterialExercise): string {
  const id = formatOf(ex)
  if (id === 'match_translation' || id === 'match_definition') return 'Соедини пары'
  if (id === 'tfng') return 'True / False'
  return formatLabel(ex)
}
