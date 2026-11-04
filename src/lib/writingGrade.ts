// ============================================================================
// Описание: src/features/writing/CLAUDE.md
// AI-оценка письма: «свой экзаменатор» (журнал п.77). Модель заполняет лист
// экзаменатора по официальной шкале — IELTS (4 критерия) или CEFR (4 стороны
// текста) — с цитатами; балл, потолки и порядок советов считает домен
// `domains/writing` (examiner.ts). Оба режима: список ошибок (было → стало),
// сильные стороны, повторяющиеся ошибки, 1–2 переписанных фразы.
// task 'writing' (heavy).
// ============================================================================
import { chat } from '../shared/api/ai'
import {
  ASPECTS,
  cefrLevel,
  cefrScale,
  cefrSchema,
  CRITERIA,
  ieltsScale,
  ieltsSchema,
  MIN_WORDS,
  modelLimits,
  paragraphCount,
  scoreCefr,
  scoreIelts,
  textFacts,
  wordCount,
  type AspectKey,
  type CefrMark,
  type CritKey,
  type FocusItem,
  type IeltsKind,
  type IeltsMark,
  type NextStep,
} from '../domains/writing'
import type { AppLang, WritingGrade, WritingTask } from '../types'
import { CORRECTION_RULES } from './correctionRules'
import { ADDRESS_RULE, variantRule } from './promptRules'

/**
 * Сколько пунктов в фокусе.
 *
 * ⚠️ Направленная правка работает лучше сплошной: список из двадцати пометок
 * не говорит, за что взяться, и вдобавок учит писать проще — безопаснее не
 * рисковать сложной конструкцией, чем получить очередную россыпь красного.
 * Три — потолок: больше уже неотличимо от «исправь всё». Первыми — то, что
 * сильнее поднимет балл (журнал п.77), потом повторяющиеся ошибки.
 */
export const MAX_FOCUS = 3
/** «Что подтянуть» у учителя (d7-3) — тот же порядок, длиннее. */
const MAX_IMPROVE = 6

/** Одна и та же инструкция про повторяющиеся ошибки для обоих режимов — чтобы не разошлись. */
const FOCUS_RULE = [
  'focus — 1-3 ПОВТОРЯЮЩИХСЯ типа ошибок, над которыми ученику стоит работать.',
  'Тип — это закономерность («артикли перед исчисляемыми», «времена в придаточных»), а НЕ отдельная опечатка.',
  'Бери только то, что встретилось НЕ МЕНЕЕ двух раз; если повторов нет — верни один-два самых мешающих пониманию типа.',
  'why — одно предложение по-русски: чем это мешает читателю. examples — до трёх пар was/fix из текста ученика.',
].join('\n')

/**
 * Виды правок — по ним проверка учителя группирует правки (макет d7-3:
 * «Грамматика · 2», «Связность · 1», «Лексика · 1»), в этом порядке. У правки
 * ещё короткое «почему» (`why`, «Предлог: at home»); у работ до 21.10.2026
 * его нет, а вид бывает и другим словом — `errorKind` сводит.
 */
export const ERROR_KINDS = [
  { id: 'grammar', label: 'Грамматика' },
  { id: 'coherence', label: 'Связность' },
  { id: 'vocab', label: 'Лексика' },
  { id: 'spelling', label: 'Орфография' },
] as const
export type ErrorKind = (typeof ERROR_KINDS)[number]['id']

/**
 * Вид правки из того, что прислала модель (или лежит в старой работе): модель
 * пишет и «article», «lexis», «linking» — без сведения они ушли бы в «Другое».
 */
export function errorKind(type: string | undefined): ErrorKind | null {
  const t = (type ?? '').toLowerCase()
  if (/gramm|article|tense|preposition|agreement/.test(t)) return 'grammar'
  if (/coher|cohes|link|connect|discourse/.test(t)) return 'coherence'
  if (/vocab|lexi|word|colloc/.test(t)) return 'vocab'
  if (/spell|punct|orthog/.test(t)) return 'spelling'
  return null
}

/** Одна инструкция про правки для обоих режимов — «почему» и виды не разойдутся. */
const ERRORS_RULE = [
  'errors — КАЖДАЯ ошибка текста, даже мелкая: was — точная цитата из текста ученика (ровно как написано, чтобы её можно было найти в тексте), fix — исправление,',
  'type — grammar (грамматика, артикли, предлоги), coherence (связки и логика между предложениями: «On the other hand», «However»), vocab (слово или сочетание), spelling (орфография, пунктуация);',
  'why — 2-6 слов по-русски: правило или подсказка, а не пересказ правки («Предлог: at home», «Согласование: it — gives», «Устойчивая связка»).',
].join('\n')
const ERRORS_SHAPE = '"errors":[{"was":"цитата из текста","fix":"исправление","type":"grammar|coherence|vocab|spelling","why":"почему, 2-6 слов"}],'
const TAIL_SHAPE =
  '"focus":[{"type":"тип повторяющейся ошибки","why":"чем мешает, по-русски","examples":[{"was":"цитата","fix":"как надо"}]}],' +
  '"strengths":["сильная сторона"],"topics":["тема грамматики для повторения"],"words":["полезное слово"],' +
  '"rewrites":[{"was":"слабое предложение","better":"улучшенный вариант"}]}'
const MARK_SHAPE = '{"band":6,"fits":"почему эта ступень","next":{"need":"что нужно для следующей","was":"цитата","fix":"как переписать"}}'

/** Как ставится ступень — одно правило на оба режима (правило самой шкалы IELTS). */
const FIT_RULE = [
  'КАК СТАВИТСЯ СТУПЕНЬ (правило официальной шкалы): по каждому критерию (в CEFR — по каждой стороне текста) — ВЫСШАЯ ступень, ВСЕМ признакам которой работа соответствует ПОЛНОСТЬЮ. Не хватает хотя бы одного признака — ступень ниже.',
  'Не снижай за то, что описание этой ступени допускает (несколько ошибок, которые не мешают пониманию, у сильной работы — норма).',
  'ПОРЯДОК: 1) выпиши все ошибки в errors; 2) по каждому критерию сравни работу со шкалой снизу вверх; 3) только потом ставь ступени.',
  'fits — одно предложение по-русски: какой признак шкалы держит работу на этой ступени, с опорой на текст.',
  'next — чего не хватает до следующей ступени: need — признак следующей ступени простыми словами по-русски и что сделать (1-2 предложения, для ученика); was — точная цитата из текста с ОШИБКОЙ или явно слабым местом, где это видно лучше всего (пусто, если признак про весь текст); fix — как переписать это место (пусто, если was пустое). Верную фразу в was не ставь — ученик увидит её зачёркнутой как ошибку: совет взять слово богаче пиши в need («вместо prepare можно draw up»). У высшей ступени next — null.',
].join('\n')

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function asStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(asStr).filter(Boolean) : []
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && isFinite(v) ? v : undefined
}
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}
function nextStep(v: unknown): NextStep | null {
  const n = obj(v)
  const need = asStr(n.need).trim()
  return need ? { need, was: asStr(n.was).trim(), fix: asStr(n.fix).trim() } : null
}
const INCOMPLETE = 'AI вернул неполную оценку. Попробуй ещё раз.'

/** JSON из ответа модели — от первой «{» до последней «}». */
function readJson(raw: string): Record<string, unknown> {
  const s = raw.indexOf('{')
  const e = raw.lastIndexOf('}')
  if (s === -1 || e <= s) throw new Error('AI вернул не-JSON. Попробуй ещё раз.')
  return JSON.parse(raw.slice(s, e + 1)) as Record<string, unknown>
}

/** Общая часть разбора: правки, переписанные фразы, повторяющиеся ошибки (не доверяем форме). */
function readCommon(o: Record<string, unknown>) {
  const errors = (Array.isArray(o.errors) ? o.errors : [])
    .map((x) => {
      const it = obj(x)
      return {
        was: asStr(it.was),
        fix: asStr(it.fix),
        type: errorKind(asStr(it.type)) ?? (asStr(it.type) || undefined),
        why: asStr(it.why).trim().slice(0, 80) || undefined,
      }
    })
    .filter((x) => x.was && x.fix)
    .slice(0, 30)
  const rewrites = (Array.isArray(o.rewrites) ? o.rewrites : [])
    .map((x) => ({ was: asStr(obj(x).was), better: asStr(obj(x).better) }))
    .filter((x) => x.was && x.better)
    .slice(0, 3)
  // ⚠️ Не больше трёх типов и трёх примеров в каждом: «восемь главных проблем» —
  // снова сплошная разметка, только с заголовками.
  const recurring: FocusItem[] = (Array.isArray(o.focus) ? o.focus : [])
    .map((x) => {
      const it = obj(x)
      return {
        type: asStr(it.type),
        why: asStr(it.why),
        examples: (Array.isArray(it.examples) ? it.examples : [])
          .map((e) => ({ was: asStr(obj(e).was), fix: asStr(obj(e).fix) }))
          .filter((e) => e.was && e.fix)
          .slice(0, 3),
      }
    })
    .filter((f) => f.type && f.examples.length > 0)
    .slice(0, MAX_FOCUS)
  return { errors, rewrites, recurring }
}

/** Советы по влиянию на балл, потом повторяющиеся ошибки: фокус ученику и «Что подтянуть» учителю. */
function adviceFields(advice: FocusItem[], recurring: FocusItem[]): Pick<WritingGrade, 'focus' | 'improve'> {
  const all = [...advice, ...recurring]
  return {
    focus: all.slice(0, MAX_FOCUS),
    improve: all.slice(0, MAX_IMPROVE).map((f) => (f.why ? `${f.type} — ${f.why}` : f.type)),
  }
}

/** Разбор листа экзаменатора IELTS → балл по нашим правилам. Экспорт — для проверок. */
export function parseIelts(raw: string, essay: string, kind: IeltsKind): WritingGrade {
  const o = readJson(raw)
  const { errors, rewrites, recurring } = readCommon(o)
  const c = obj(o.criteria)
  const marks = {} as Record<CritKey, IeltsMark>
  for (const { key } of CRITERIA) {
    const m = c[key]
    const band = typeof m === 'number' ? m : num(obj(m).band)
    if (band === undefined) throw new Error(INCOMPLETE)
    marks[key] = { band, next: nextStep(obj(m).next) }
  }
  const facts = textFacts(essay, errors.filter((e) => e.type === 'grammar').map((e) => e.was))
  const r = scoreIelts(kind, marks, asStrArr(o.limits), facts)
  return {
    band: r.band,
    criteria: r.criteria,
    errors,
    rewrites,
    ...adviceFields(r.advice, recurring),
    strengths: asStrArr(o.strengths).slice(0, 6),
    topics: asStrArr(o.topics).slice(0, 8),
    words: asStrArr(o.words).slice(0, 12),
  }
}

/** Разбор листа CEFR → уровень по нашим правилам. Экспорт — для проверок. */
export function parseCefr(raw: string, essay: string, minWords?: number): WritingGrade {
  const o = readJson(raw)
  const { errors, rewrites, recurring } = readCommon(o)
  const a = obj(o.aspects)
  const marks = {} as Record<AspectKey, CefrMark>
  for (const { key } of ASPECTS) {
    const level = cefrLevel(obj(a[key]).level)
    if (!level) throw new Error(INCOMPLETE)
    marks[key] = { level, next: nextStep(obj(a[key]).next) }
  }
  const facts = textFacts(essay, errors.filter((e) => e.type === 'grammar').map((e) => e.was))
  const r = scoreCefr(marks, facts, minWords)
  return {
    level: r.level,
    targetWords: (Array.isArray(o.targetWords) ? o.targetWords : [])
      .map((x) => ({ w: asStr(obj(x).w), used: Boolean(obj(x).used) }))
      .filter((x) => x.w),
    targetGrammar: (Array.isArray(o.targetGrammar) ? o.targetGrammar : [])
      .map((x) => ({ t: asStr(obj(x).t), used: Boolean(obj(x).used) }))
      .filter((x) => x.t),
    errors,
    rewrites,
    ...adviceFields(r.advice, recurring),
    strengths: asStrArr(o.strengths).slice(0, 6),
    topics: asStrArr(o.topics).slice(0, 8),
    words: asStrArr(o.words).slice(0, 12),
  }
}

/** Итоговая метка для колонки band: IELTS — число, обычный — уровень. */
export function bandLabel(mode: 'ielts' | 'regular', grade: WritingGrade): string {
  if (mode === 'ielts') return grade.band != null ? String(grade.band) : ''
  return grade.level ?? ''
}

/** Вид задания IELTS по настройкам: Academic Task 1 — и без данных графика (тогда цифры не сверяем). */
export function ieltsKind(task: WritingTask): IeltsKind {
  const t = task.settings?.ieltsTask
  return t === 'academic1' ? 'academic1' : t === 'gt1' ? 'gt1' : 'task2'
}

const KIND_NAME: Record<IeltsKind, string> = {
  task2: 'Task 2 (эссе)',
  academic1: 'Academic Task 1 (описание графика или данных)',
  gt1: 'General Training Task 1 (письмо)',
}

export function ieltsPrompt(task: WritingTask, essay: string): { system: string; user: string } {
  const kind = ieltsKind(task)
  const chart = task.settings?.chart
  const words = wordCount(essay)
  const min = MIN_WORDS[kind]
  const paragraphs = paragraphCount(essay)
  const system = [
    'Ты — сертифицированный экзаменатор IELTS Writing. Оцениваешь так же строго, как на экзамене: не завышаешь слабым работам и не занижаешь сильным.',
    `Работа: ${KIND_NAME[kind]}.`,
    kind === 'academic1'
      ? chart
        ? 'Данные графика даны НИЖЕ в JSON — сверяй по ним каждую цифру и тенденцию: неверная цифра или тренд, причины и мнения вне данных — ошибки Task Achievement.'
        : 'Данных графика нет — точность цифр не проверяй, оценивай обзор, отбор главного и сравнения.'
      : '',
    `Факты о работе (посчитала программа — им верь): слов ${words}, минимум ${min}${words < min ? ' — работа короче минимума, идеи недоразвиты: учитывай это в критерии task' : ''}; абзацев ${paragraphs}.`,
    FIT_RULE,
    'Ступени — только целые числа от 0 до 9. Общий балл НЕ ставь — его посчитает программа по правилам IELTS.',
    `limits — коды ⛔-признаков шкалы, которые ЕСТЬ в работе, из списка: ${modelLimits(kind).join(', ')}; нет — пустой список.`,
    `ШКАЛА (официальные band descriptors IELTS; ⛔ — признак, ограничивающий ступень; [limit: код] — его код для limits):\n${ieltsScale(kind)}`,
    'Верни ТОЛЬКО валидный JSON без markdown, ключи — в этом порядке:',
    '{' + ERRORS_SHAPE + `"criteria":{"task":${MARK_SHAPE},"coherence":{…},"lexis":{…},"grammar":{…}},"limits":[],` + TAIL_SHAPE,
    ERRORS_RULE,
    FOCUS_RULE,
    // те же правила, что в «Диалоге» (lib/correctionRules): не сдвигать время
    // в исправлении и не выдумывать ошибок — здесь тот же разбор чужого текста
    ...CORRECTION_RULES,
    'Пояснения (fits, need, why, strengths, topics) — по-русски; английские слова и фразы — на английском.',
    ADDRESS_RULE,
  ]
    .filter(Boolean)
    .join('\n')
  const user = [
    `Вопрос задания:\n${task.prompt}`,
    kind === 'academic1' && chart ? `\nДанные графика (JSON):\n${JSON.stringify(chart)}` : '',
    `\nОтвет ученика:\n${essay}`,
  ].join('\n')
  return { system, user }
}

export function cefrPrompt(task: WritingTask, essay: string, lang: AppLang): { system: string; user: string } {
  const subject = lang === 'es' ? 'испанского' : 'английского'
  const words = task.settings?.targetWords ?? []
  const grammar = task.settings?.targetGrammar ?? []
  const min = task.settings?.minWords
  const count = wordCount(essay)
  const system = [
    `Ты — экзаменатор письма по шкале CEFR, преподаватель ${subject}. Оцениваешь строго, как на экзамене: не завышаешь и не занижаешь.`,
    `Задание рассчитано на уровень ${task.level}, но уровень ставь по ТЕКСТУ, а не по заданию.`,
    `Факты о тексте (посчитала программа — им верь): слов ${count}${min ? `, минимум ${min}` : ''}.`,
    words.length ? `Целевые слова, которые ученик должен был употребить: ${words.join(', ')}.` : 'Целевые слова не заданы.',
    grammar.length ? `Целевая грамматика: ${grammar.join(', ')}.` : 'Целевая грамматика не задана.',
    FIT_RULE,
    'Уровень — A1, A2, B1, B2, C1 или C2. Общий уровень НЕ ставь — его посчитает программа.',
    `ШКАЛА (CEFR, письменная речь):\n${cefrScale()}`,
    'Верни ТОЛЬКО валидный JSON без markdown, ключи — в этом порядке:',
    '{' +
      ERRORS_SHAPE +
      `"aspects":{"task":${MARK_SHAPE.replace('"band":6', '"level":"B1"')},"range":{…},"accuracy":{…},"coherence":{…}},` +
      '"targetWords":[{"w":"слово","used":true}],"targetGrammar":[{"t":"структура","used":true}],' +
      TAIL_SHAPE,
    'targetWords/targetGrammar — по КАЖДОМУ целевому слову и структуре из списков выше: правда ли ученик их употребил (used).',
    ERRORS_RULE,
    FOCUS_RULE,
    ...CORRECTION_RULES,
    ADDRESS_RULE,
    variantRule(lang),
    'Пояснения (fits, need, why, strengths, topics) — по-русски; слова и фразы изучаемого языка — на нём самом.',
  ]
    .filter(Boolean)
    .join('\n')
  return { system, user: `Задание:\n${task.prompt}\n\nТекст ученика:\n${essay}` }
}

export async function gradeWriting(task: WritingTask, essay: string, lang: AppLang): Promise<WritingGrade> {
  // схема ответа: длинный лист экзаменатора не ломается (api/_geminiBody.ts)
  if (task.mode === 'ielts') {
    const kind = ieltsKind(task)
    const { system, user } = ieltsPrompt(task, essay)
    const raw = await chat([{ role: 'user', content: user }], { system, task: 'writing', json: ieltsSchema(kind) })
    return parseIelts(raw, essay, kind)
  }
  const { system, user } = cefrPrompt(task, essay, lang)
  const raw = await chat([{ role: 'user', content: user }], { system, task: 'writing', json: cefrSchema() })
  return parseCefr(raw, essay, task.settings?.minWords)
}
