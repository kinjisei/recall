// ============================================================================
// Правила подбора домашки. ОДНО место, где решается, что попадёт в набор.
//
// Почему отдельным файлом и без единого runtime-импорта: сюда ходят и экран
// преподавателя, и сборка с AI, и чистый тест (scripts/test-homework-suggest.mjs
// импортирует этот модуль напрямую в node). Правило, размазанное по экрану и
// промпту, разошлось бы молча — ровно как разошлись бы две копии диагностики.
//
// ⚠️ ЧТО РЕШАЮТ ДАННЫЕ, А ЧТО AI. Состав набора считается ЗДЕСЬ, из состояний
// FSRS и диагностики. AI не выбирает, сколько слов задать и какой взять текст —
// он только связывает готовые пункты в осмысленную неделю под цель ученика и
// пишет формулировки. Поэтому отказ AI (кончились генерации, модель молчит) не
// ломает кнопку: набор соберётся и без него, просто формулировки будут наши.
//
// Источники правил (не выдумка, а то, на что опираемся):
//   • 8–10 новых слов в день — потолок, выше которого удержание не растёт, а
//     время растёт вдвое; 20 слов в день дают то же, что 5.
//   • 95–98% знакомых слов в тексте — условие, при котором чтение работает как
//     обучение, а не как расшифровка.
//   • Баланс рецептивного (чтение) и продуктивного (письмо/речь) + повторение.
//   • 4–5 коротких заходов за неделю лучше одного длинного.
//   • Два пункта НА ВЫБОР: возможность выбрать повышает завершаемость
//     (Patall, Cooper & Robinson).
// ============================================================================
// ⚠️ Расширение обязательно: этот модуль грузит не только Vite, но и node
// напрямую (scripts/test-homework-suggest.mjs), а node без расширения
// относительный импорт не находит. Тот же приём — в lib/recentWords.
import { plural } from './text.ts'
import type { AppLang, CEFRLevel } from '../types'
import type { HomeworkKind, NewHomeworkItem } from './homework'

// ---------------------------------------------------------------------------
// Числа правил. Держим отдельными константами: тест проверяет ИМЕННО их, и
// при попытке «поднять лимит на глазок» он покраснеет.
// ---------------------------------------------------------------------------

/** Потолок новых слов на один день занятий. Выше — время растёт, толк нет. */
export const NEW_WORDS_PER_DAY_MAX = 10
/** Наш рабочий шаг внутри потолка: восемь на заход. */
export const NEW_WORDS_PER_SESSION = 8
/** Коротких заходов за неделю. Частота важнее объёма. */
export const SESSIONS_PER_WEEK = 4
/** Повторений за заход — сколько карточек реально прогнать за 10 минут. */
export const REVIEW_PER_SESSION = 20

/** Окно покрытия текста: столько слов ученику уже знакомо. */
export const COVERAGE_WINDOW = { min: 0.95, max: 0.98 } as const
/** Середина окна — к ней и стремимся при выборе. */
export const COVERAGE_TARGET = (COVERAGE_WINDOW.min + COVERAGE_WINDOW.max) / 2

/** Больше шести пунктов на неделю — это уже не домашка, а список дел. */
export const MAX_ITEMS = 6
/** Ровно столько пунктов даём на выбор. */
export const PICK_SIZE = 2

/** Порядок уровней — для «текст не выше ученика». */
export const LEVEL_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
export const levelRank = (l: string | null | undefined): number => {
  const i = LEVEL_ORDER.indexOf(l as CEFRLevel)
  return i === -1 ? 2 : i // неизвестный уровень считаем B1: не завышаем и не занижаем
}

// ---------------------------------------------------------------------------
// Заходы и объёмы
// ---------------------------------------------------------------------------

/** Сколько коротких заходов укладывается в срок. Минимум один. */
export function sessionsFor(days: number): number {
  const d = Math.max(1, Math.round(days))
  return Math.max(1, Math.round((d * SESSIONS_PER_WEEK) / 7))
}

/**
 * Сколько НОВЫХ слов можно задать на срок. Считается от заходов, а сверху
 * прижимается жёстким потолком «не больше 10 в день» — на случай, если
 * когда-нибудь захочется поднять шаг за заход.
 */
export function newWordsBudget(days: number): number {
  const d = Math.max(1, Math.round(days))
  return Math.min(sessionsFor(d) * NEW_WORDS_PER_SESSION, d * NEW_WORDS_PER_DAY_MAX)
}

/**
 * Сколько карточек ставим на повторение. Просрочка бывает любой (200 карточек
 * после месяца без занятий), но задание должно быть выполнимым: берём то, что
 * реально прогнать за заходы этой недели.
 */
export function reviewTarget(dueCards: number, days: number): number {
  return Math.max(0, Math.min(Math.round(dueCards), sessionsFor(days) * REVIEW_PER_SESSION))
}

// ---------------------------------------------------------------------------
// Покрытие текста
//
// ⚠️ ЧЕСТНАЯ ГРАНИЦА, читать до того, как поверить проценту.
// Окно 95–98% — правило про ПОЛНЫЙ словарь ученика. Мы же можем сверить текст
// только с тем, что у нас есть: карточки ученика (состояния FSRS), «База
// уровня» до его уровня, неправильные глаголы и служебные слова. Словари
// приложения — учебные (4000 Essential Words начинается с A2), базовой лексики
// A1 в них нет вовсе. Измерено на живых данных: даже сверка со ВСЕМ английским
// словарём (4844 слова) даёт по нашим 28 текстам 73,7%, лучший испанский текст
// — 91%. То есть в окно не попадает НИ ОДИН текст, и попасть не может.
//
// Поэтому число здесь — оценка СНИЗУ, и обращаемся мы с ней соответственно:
// сравниваем тексты между собой (это сравнение верное — метрика монотонна по
// знанию ученика) и берём лучший, а окно служит целью, а не фильтром. В
// интерфейсе так и пишем: «самый посильный из текстов его уровня», без обещания
// «96% знакомо».
// ---------------------------------------------------------------------------

/**
 * Служебные слова — закрытый класс: артикли, местоимения, предлоги, союзы,
 * связки, числительные. Их знает любой с первого урока, но в частотные учебные
 * списки они не входят, и без них покрытие занижено на треть.
 */
export const FUNCTION_WORDS: Record<AppLang, string[]> = {
  en: `a an the this that these those i you he she it we they me him her us them
  my your his its our their mine yours hers ours theirs
  myself yourself himself herself itself ourselves themselves
  am is are was were be been being have has had having do does did doing
  will would shall should can could may might must let
  and or but so because if then than as while when where what which who whom whose why how
  in on at to from by with without for of about into onto over under above below
  between among through during after before against along across behind beside
  again very too also just only not no nor yes there here now
  one two three four five six seven eight nine ten hundred thousand
  first second third next last many much more most few less least
  some any all both each every other another same such own none
  up down out off back away around near far once
  always never often sometimes usually still already yet ever else
  mr mrs ms dr ok okay please thanks hello hi bye`
    .split(/\s+/)
    .filter(Boolean),
  es: `el la los las un una unos unas lo al del
  yo tu tú él ella nosotros nosotras vosotros vosotras ellos ellas usted ustedes
  me te se nos os le les mi mis su sus nuestro nuestra nuestros nuestras
  ser soy eres es somos sois son era eran fue fui
  estar estoy estás está estamos están estaba
  haber he has ha hemos han había hay
  y e o u pero sino porque que si como cuando donde cual quien cuyo
  en de a con sin por para sobre bajo entre hasta desde hacia según durante
  no ni sí también tampoco muy más menos mucho muchos mucha poco pocos
  uno dos tres cuatro cinco seis siete ocho nueve diez cien mil
  todo todos toda todas otro otra otros otras mismo misma cada alguno alguna
  aquí allí ahí ahora luego siempre nunca ya todavía aún casi solo sólo
  bien mal así entonces pues aunque mientras señor señora hola gracias adiós`
    .split(/\s+/)
    .filter(Boolean),
}

/** Слова текста: только буквы и апострофы, регистр снят. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}']+/gu) ?? [])
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean)
}

/**
 * Возможные словарные формы слова. Без этого «students» не находит «student», и
 * покрытие проседает на десяток процентов на ровном месте. Стеммер нарочно
 * грубый: он работает на СРАВНЕНИЕ текстов между собой, а лишняя точность здесь
 * дороже, чем стоит.
 */
export function wordForms(w: string): string[] {
  const out = new Set<string>([w])
  const add = (s: string) => s.length >= 2 && out.add(s)
  if (w.endsWith("'s") || w.endsWith("'")) add(w.replace(/'s?$/, ''))
  if (w.endsWith('ies')) add(w.slice(0, -3) + 'y')
  if (w.endsWith('es')) add(w.slice(0, -2))
  if (w.endsWith('s')) add(w.slice(0, -1))
  if (w.endsWith('ed')) {
    add(w.slice(0, -1))
    add(w.slice(0, -2))
    add(w.slice(0, -3))
  }
  if (w.endsWith('ing')) {
    add(w.slice(0, -3))
    add(w.slice(0, -3) + 'e')
  }
  if (w.endsWith('ly')) add(w.slice(0, -2))
  if (w.endsWith('er')) {
    add(w.slice(0, -1))
    add(w.slice(0, -2))
  }
  if (w.endsWith('est')) add(w.slice(0, -3))
  // испанский: род и множественное число
  if (w.endsWith('a')) add(w.slice(0, -1) + 'o')
  if (w.endsWith('as')) add(w.slice(0, -2) + 'o')
  if (w.endsWith('os')) add(w.slice(0, -2) + 'o')
  return [...out]
}

export interface Coverage {
  /** Доля знакомых слов — ОЦЕНКА СНИЗУ, см. шапку раздела. */
  pct: number
  /** Слов в тексте всего. */
  total: number
  /** Незнакомых слов (с повторами: важна нагрузка, а не разнообразие). */
  unknown: number
  /** До десяти незнакомых слов — их и стоит разобрать на уроке. */
  samples: string[]
}

/** Доля слов текста, которые ученик уже знает. */
export function coverage(body: string, known: Set<string>): Coverage {
  const words = tokenize(body)
  if (words.length === 0) return { pct: 0, total: 0, unknown: 0, samples: [] }
  let ok = 0
  const misses = new Set<string>()
  for (const w of words) {
    if (wordForms(w).some((f) => known.has(f))) ok++
    else misses.add(w)
  }
  return {
    pct: ok / words.length,
    total: words.length,
    unknown: words.length - ok,
    samples: [...misses].slice(0, 10),
  }
}

export interface TextCandidate {
  id: string
  title: string
  level: string
  body: string
}

export interface PickedText {
  id: string
  title: string
  level: string
  coverage: Coverage
  /** Попал ли в окно 95–98% — с нашими словарями почти всегда false, см. шапку. */
  inWindow: boolean
}

/**
 * Текст для чтения: не выше уровня ученика, с покрытием как можно ближе к
 * середине окна. Тексты выше уровня берём только если своих не нашлось — лучше
 * трудный текст, чем пустой пункт.
 */
export function pickText(
  texts: TextCandidate[],
  known: Set<string>,
  level: string | null,
): PickedText | null {
  if (texts.length === 0) return null
  const max = levelRank(level)
  const fit = texts.filter((t) => levelRank(t.level) <= max)
  const pool = fit.length > 0 ? fit : texts

  let best: PickedText | null = null
  let bestScore = Infinity
  for (const t of pool) {
    const c = coverage(t.body, known)
    const inWindow = c.pct >= COVERAGE_WINDOW.min && c.pct <= COVERAGE_WINDOW.max
    // Попавшие в окно всегда лучше не попавших; внутри группы — ближе к цели.
    const score = (inWindow ? 0 : 1) + Math.abs(c.pct - COVERAGE_TARGET)
    if (score < bestScore) {
      bestScore = score
      best = { id: t.id, title: t.title, level: t.level, coverage: c, inWindow }
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Баланс набора
// ---------------------------------------------------------------------------

/** К чему относится тип пункта. 'free' — ни к чему: что там, знает учитель. */
export type Side = 'receptive' | 'productive' | 'review' | 'other'

export const SIDE_OF: Record<HomeworkKind, Side> = {
  text: 'receptive',
  writing: 'productive',
  speech: 'productive',
  quest: 'productive',
  words: 'review',
  free: 'other',
}

export const SIDE_LABEL: Record<Side, string> = {
  receptive: 'чтение',
  productive: 'письмо и речь',
  review: 'повторение',
  other: 'своё',
}

/** Сколько пунктов каждой стороны в наборе. */
export function balanceOf(items: { kind: HomeworkKind }[]): Record<Side, number> {
  const out: Record<Side, number> = { receptive: 0, productive: 0, review: 0, other: 0 }
  for (const i of items) out[SIDE_OF[i.kind]]++
  return out
}

/** Каких сторон в наборе не хватает. Пусто — набор сбалансирован. */
export function missingSides(items: { kind: HomeworkKind }[]): Side[] {
  const b = balanceOf(items)
  return (['review', 'receptive', 'productive'] as Side[]).filter((s) => b[s] === 0)
}

export const isBalanced = (items: { kind: HomeworkKind }[]): boolean =>
  missingSides(items).length === 0

// ---------------------------------------------------------------------------
// Сам набор
// ---------------------------------------------------------------------------

/** Что известно про ученика к моменту сборки — всё из данных, ничего из AI. */
export interface SuggestFacts {
  lang: AppLang
  level: string | null
  /** Срок домашки в днях. */
  days: number
  /** Карточек к повторению (срок подошёл). */
  dueCards: number
  /** Всего карточек в колоде языка. */
  totalCards: number
  /** Слова, на которых ученик срывается чаще всего. */
  struggling: string[]
  /** Слабые темы грамматики (названия уроков). */
  weakTopics: string[]
  /** Подобранный текст — или null, если текстов нет. */
  text: PickedText | null
  /** Дней с занятиями за последние 14. */
  activeDays14: number
  /** Цель обучения ученика (profiles.goal), если указана. */
  goal: string | null
}

/** Пункт набора: обычный пункт домашки плюс объяснение, откуда он взялся. */
export interface SuggestedItem extends NewHomeworkItem {
  /** Почему пункт здесь — показываем преподавателю, чтобы он мог не поверить. */
  why: string
  /** Пункты с одним номером — альтернативы, ученик сделает ОДИН из них. */
  pickGroup?: number
}

/** Слова через запятую, но не больше n — для заголовков и объяснений. */
const few = (arr: string[], n = 3): string => arr.slice(0, n).join(', ')

/**
 * Базовый набор — прямо из данных, без AI. Он же запасной вариант, если
 * генерация недоступна, он же основа, которую AI разрешено только
 * переформулировать.
 *
 * ⚠️ Пункт «Слова» ровно один. Сервер считает выполнение по РАЗНЫМ карточкам,
 * тронутым после выдачи (homework_item_progress, kind='words'), поэтому два
 * словарных пункта закрывались бы одновременно и одинаково — ученик видел бы
 * два задания, а делал одно.
 */
export function buildBaseline(f: SuggestFacts): SuggestedItem[] {
  const items: SuggestedItem[] = []
  const sessions = sessionsFor(f.days)
  const fresh = newWordsBudget(f.days)
  const review = reviewTarget(f.dueCards, f.days)

  // 1. Повторение + новые слова — одним пунктом (см. предупреждение выше).
  const wordsTarget = Math.max(1, review + fresh)
  items.push({
    kind: 'words',
    title:
      review > 0
        ? `Слова: повторить ${review} и выучить ${fresh} новых`
        : `Выучить ${fresh} ${plural(fresh, 'новое слово', 'новых слова', 'новых слов')}`,
    target: wordsTarget,
    why:
      (review > 0
        ? `${f.dueCards} ${plural(f.dueCards, 'карточка ждёт', 'карточки ждут', 'карточек ждут')} повторения. `
        : 'Просроченных карточек нет. ') +
      `Новых — ${fresh}: это ${NEW_WORDS_PER_SESSION} за заход при ${sessions} ` +
      `${plural(sessions, 'заходе', 'заходах', 'заходах')}, ` +
      `внутри потолка ${NEW_WORDS_PER_DAY_MAX} слов в день.` +
      (f.struggling.length > 0 ? ` Особенно буксуют: ${few(f.struggling)}.` : ''),
  })

  // 2. Чтение — подобранный по покрытию текст.
  if (f.text) {
    const pct = Math.round(f.text.coverage.pct * 100)
    items.push({
      kind: 'text',
      title: `Прочитать «${f.text.title}» и разобрать незнакомое`,
      target: 1,
      why:
        `Самый посильный текст уровня ${f.text.level}: знакомо ≈${pct}% слов ` +
        `(${f.text.coverage.unknown} незнакомых из ${f.text.coverage.total}).` +
        (f.text.coverage.samples.length > 0
          ? ` Разобрать: ${few(f.text.coverage.samples, 4)}.`
          : ''),
    })
  } else {
    items.push({
      kind: 'text',
      title: 'Прочитать текст и разобрать незнакомое',
      target: 1,
      why: 'Текстов для этого языка в приложении не нашлось — выбери сам.',
    })
  }

  // 3. Продуктивное — письмо: единственное задание, которое проверяется по
  //    критериям и даёт разбор.
  items.push({
    kind: 'writing',
    title: 'Написать короткий текст и отправить на проверку',
    target: 1,
    why:
      'В наборе должно быть продуктивное задание: узнавать слова и уметь их ' +
      'применить — разные умения.' +
      (f.goal ? ` Цель ученика: ${GOAL_LABEL[f.goal] ?? f.goal}.` : ''),
  })

  // 4-5. Два пункта НА ВЫБОР. Обе альтернативы равноценны — выбор нужен ради
  //      самого выбора, а не чтобы подсунуть задание полегче.
  const topic = f.weakTopics[0]
  // ⚠️ Именно «проговорить выученные слова», а не «пофразы вообще». Тренажёр
  // ставит свои слова ученика первыми (features/pronunciation), и смысл пункта
  // в этом: произнесение вслух закрепляет форму слова, а не только узнавание.
  items.push({
    kind: 'speech',
    title: 'Проговорить вслух 5 выученных слов',
    target: 5,
    pickGroup: 1,
    why:
      'Произнести вслух то, что выучил, — отдельный приём: закрепляется форма слова, ' +
      'а не только узнавание. На выбор с квестом: возможность выбрать повышает шанс, что задание сделают.',
  })
  items.push({
    kind: 'quest',
    title: topic ? `Пройти квест по теме «${topic}»` : 'Пройти AI-квест по грамматике',
    target: 1,
    pickGroup: 1,
    why: topic
      ? `На выбор с речью. Тема взята из ошибок ученика: ${few(f.weakTopics)}.`
      : 'На выбор с речью. Слабых тем в данных нет — квест общий, поправь тему сам.',
  })

  return items
}

/** Подписи целей обучения (profiles.goal) — те же, что в онбординге. */
export const GOAL_LABEL: Record<string, string> = {
  exam: 'подготовка к экзамену',
  school: 'школа',
  work: 'работа',
  travel: 'поездки',
  self: 'для себя',
}

/**
 * Приводит ЛЮБОЙ набор к правилам. Через неё проходит и результат AI, и
 * отредактированный преподавателем набор перед отправкой.
 *
 * Что чинит:
 *   • больше одного словарного пункта — оставляет первый (иначе они закрываются
 *     одновременно, см. buildBaseline);
 *   • завышенный объём слов — прижимает к бюджету правил;
 *   • перекос — добавляет недостающую сторону из базового набора;
 *   • группу выбора не из двух пунктов — доводит до двух или распускает;
 *   • длину набора — не больше MAX_ITEMS.
 */
export function applyRules(items: SuggestedItem[], f: SuggestFacts): SuggestedItem[] {
  const base = buildBaseline(f)
  const cap = reviewTarget(f.dueCards, f.days) + newWordsBudget(f.days)

  // 1. Один словарный пункт, объём внутри бюджета.
  let seenWords = false
  let out: SuggestedItem[] = []
  for (const it of items) {
    const title = (it.title ?? '').trim()
    if (!title) continue
    if (it.kind === 'words') {
      if (seenWords) continue
      seenWords = true
      out.push({ ...it, title, target: Math.max(1, Math.min(it.target ?? cap, cap)) })
      continue
    }
    out.push({ ...it, title, target: Math.max(1, Math.min(it.target ?? 1, 500)) })
  }

  // 2. Баланс: чего нет — берём из базового набора.
  for (const side of missingSides(out)) {
    const donor = base.find((b) => SIDE_OF[b.kind] === side && !b.pickGroup)
    if (donor) out.push({ ...donor })
  }

  // 3. Обрезаем длину, но так, чтобы баланс не потерялся: сперва режем
  //    «своими словами» и лишние продуктивные, а не единственное чтение.
  if (out.length > MAX_ITEMS) {
    const keep: SuggestedItem[] = []
    const rest: SuggestedItem[] = []
    const taken = new Set<Side>()
    for (const it of out) {
      const side = SIDE_OF[it.kind]
      if (side !== 'other' && !taken.has(side)) {
        taken.add(side)
        keep.push(it)
      } else rest.push(it)
    }
    out = [...keep, ...rest].slice(0, MAX_ITEMS)
  }

  // 4. Группа выбора — ровно PICK_SIZE пунктов. Одиночку распускаем (пункт
  //    «на выбор» из одного варианта — это просто пункт), лишних тоже.
  const groups = new Map<number, SuggestedItem[]>()
  for (const it of out) {
    if (it.pickGroup == null) continue
    const arr = groups.get(it.pickGroup) ?? []
    arr.push(it)
    groups.set(it.pickGroup, arr)
  }
  for (const [, arr] of groups) {
    if (arr.length === PICK_SIZE) continue
    for (const it of arr.slice(PICK_SIZE)) delete it.pickGroup
    if (arr.length < PICK_SIZE) for (const it of arr) delete it.pickGroup
  }

  return out
}

/**
 * Сколько пунктов реально придётся сделать: группа выбора — это ОДИН пункт.
 * Та же арифметика, что у homeworkProgress, — держим рядом с правилами, чтобы
 * счёт в сборке и счёт в карточке не разошлись.
 */
export function countableItems(items: { pickGroup?: number }[]): number {
  const groups = new Set<number>()
  let single = 0
  for (const it of items) {
    if (it.pickGroup == null) single++
    else groups.add(it.pickGroup)
  }
  return single + groups.size
}
