// ============================================================================
// «Собрать домашку» — приложение предлагает набор, преподаватель правит.
//
// Разделение труда, ради которого всё и затевалось:
//   ДАННЫЕ решают СОСТАВ. Сколько слов повторить — по состояниям FSRS. Какой
//   текст читать — по покрытию (lib/homeworkRules). Какая тема квеста — по
//   ошибкам из диагностики. Ни одно из этих чисел не спрашивается у модели.
//   AI решает ФОРМУЛИРОВКИ. Он получает готовый набор и цель ученика и пишет
//   заголовки пунктов и заметку на неделю — то есть связывает набор в занятие,
//   а не выдумывает его.
//
// ⚠️ Отсюда важное следствие: отказ AI не ломает кнопку. Кончились месячные
// генерации, модель молчит, интернет отвалился — набор всё равно соберётся, и
// преподаватель увидит его с нашими формулировками. Проверять «а вдруг AI
// недоступен» отдельной веткой в интерфейсе не нужно.
//
// ⚠️ Сводка диагностики — ТОЛЬКО из lib/diagnosticsBrief (studentBriefBlock).
// Она общая с программой обучения и генерацией заданий: второй экземпляр
// разошёлся бы с первым молча, и три экрана начали бы по-разному представлять
// одного и того же ученика.
//
// ⚠️ Это ГЕНЕРАЦИЯ преподавателя (task 'homework' в api/_tasks.ts): списывается
// из месячного лимита генераций, а не из энергии ученика.
// ============================================================================
import { chat } from './gemini'
import { getStudentDiagnostics } from './diagnostics'
import { grammarCatalog, studentBriefBlock } from './diagnosticsBrief'
import { getStudentWords } from './wordChecks'
import { supabase } from './supabase'
import { plural } from './text'
import {
  FUNCTION_WORDS,
  GOAL_LABEL,
  MAX_ITEMS,
  applyRules,
  buildBaseline,
  levelRank,
  pickText,
  sessionsFor,
  type SuggestFacts,
  type SuggestedItem,
  type TextCandidate,
} from './homeworkRules'
import type { AppLang } from '../types'

export type { SuggestFacts, SuggestedItem } from './homeworkRules'

export interface Suggestion {
  items: SuggestedItem[]
  /** Заметка ученику: в каком порядке и почему. */
  note: string
  facts: SuggestFacts
  /** false — AI не ответил, формулировки наши. Показываем честно. */
  fromAi: boolean
}

// ---------------------------------------------------------------------------
// Что ученик уже знает
// ---------------------------------------------------------------------------

/**
 * Словарь, по которому меряем покрытие текста: служебные слова + «База уровня»
 * до уровня ученика + его собственные карточки + (для английского) формы
 * неправильных глаголов.
 *
 * ⚠️ Карточки берём ТОЛЬКО те, что ученик уже начал: статус new означает, что
 * слово лежит в колоде нетронутым, и считать его знакомым — врать себе.
 */
async function loadKnownWords(
  lang: AppLang,
  level: string | null,
  studiedCards: string[],
): Promise<Set<string>> {
  const known = new Set<string>(FUNCTION_WORDS[lang])
  const max = levelRank(level)

  if (lang === 'es') {
    const m = await import('../data/spanish/words')
    for (const w of m.allWords) {
      if (levelRank(w.level) > max) continue
      const s = w.spanish.toLowerCase().trim()
      known.add(s)
      // испанские записи бывают с артиклем и вариантами через «/»
      for (const part of s.split(/[\s,/]+/)) if (part.length > 1) known.add(part)
    }
  } else {
    const [m, irr] = await Promise.all([
      import('../data/english/words'),
      import('../data/english/irregular'),
    ])
    for (const w of m.allWords) {
      if (levelRank(w.level) > max) continue
      known.add(w.english.toLowerCase().trim())
    }
    // was/were, went, gone — в частотный список они не входят, а в тексте есть
    for (const g of irr.irregularGroups) {
      for (const v of g.verbs) {
        for (const form of [v.base, v.past, v.part]) {
          for (const one of form.split('/')) known.add(one.toLowerCase().trim())
        }
      }
    }
  }

  for (const front of studiedCards) {
    const s = front.toLowerCase().trim()
    known.add(s)
    for (const part of s.split(/[\s,/]+/)) if (part.length > 1) known.add(part)
  }
  return known
}

/** Тексты для чтения — в общем виде, независимо от языка. */
async function loadTexts(lang: AppLang): Promise<TextCandidate[]> {
  if (lang === 'es') {
    const m = await import('../data/spanish')
    return m.spanishReadings.map((r) => ({
      id: String(r.id),
      title: r.title,
      level: r.level,
      body: r.paragraphs.map((p) => p.es).join('\n'),
    }))
  }
  // Тексты ученика лежат в модуле читалки — это чистые данные без React,
  // поэтому берём их оттуда, а не заводим вторую копию в data/.
  const m = await import('../features/reader/sampleTexts')
  return m.sampleTexts.map((t) => ({ id: t.id, title: t.title, level: t.level, body: t.body }))
}

// ---------------------------------------------------------------------------
// Факты про ученика
// ---------------------------------------------------------------------------

/**
 * Всё, из чего собирается набор. Ничего не спрашивает у AI и ничего не пишет
 * в базу — только чтение под RLS преподавателя.
 */
export async function collectFacts(
  studentId: string,
  lang: AppLang,
  level: string | null,
  days: number,
): Promise<SuggestFacts> {
  const [words, diag, { topics }, profileRes] = await Promise.all([
    getStudentWords(studentId),
    getStudentDiagnostics(studentId),
    grammarCatalog(lang),
    supabase.from('profiles').select('goal, level').eq('id', studentId).maybeSingle(),
  ])
  const titles = new Map(topics.map((t) => [t.id, t.title]))

  // Карточки только нужного языка: у ученика бывают обе колоды, и английский
  // текст нельзя мерить по испанским словам.
  const now = Date.now()
  const langCards = words.filter((w) => w.lang === lang)
  const studied = langCards.filter((w) => w.status !== 'new')
  const dueCards = studied.filter((w) => w.state && new Date(w.state.due).getTime() <= now).length

  const effLevel = level ?? (profileRes.data?.level as string | null) ?? null
  const known = await loadKnownWords(
    lang,
    effLevel,
    studied.map((w) => w.card.front),
  )
  const texts = await loadTexts(lang)

  return {
    lang,
    level: effLevel,
    days,
    dueCards,
    totalCards: langCards.length,
    struggling: diag.words.struggling.map((w) => w.front),
    weakTopics: diag.mistakes
      .filter((m) => m.lang === lang)
      .map((m) => titles.get(m.topicId) ?? `тема №${m.topicId}`),
    text: pickText(texts, known, effLevel),
    activeDays14: diag.activeDays14,
    goal: (profileRes.data?.goal as string | null) ?? null,
  }
}

// ---------------------------------------------------------------------------
// Сборка
// ---------------------------------------------------------------------------

/** Достаёт JSON из ответа модели (терпит ```-обёртки и болтовню вокруг). */
function parseJson<T>(raw: string): T | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

/** Промпт. Собран отдельной функцией, чтобы смоук мог проверить его дословно. */
export function suggestPrompt(
  f: SuggestFacts,
  items: SuggestedItem[],
  brief: string,
): { system: string; user: string } {
  const langName = f.lang === 'es' ? 'испанский' : 'английский'
  const sessions = sessionsFor(f.days)

  const system = [
    'Ты — методист по иностранным языкам в приложении Recall.',
    `Преподаватель собирает домашку на ${f.days} дн. для ученика (${langName}).`,
    '',
    'СОСТАВ НАБОРА УЖЕ ПОСЧИТАН по данным приложения и НЕ обсуждается.',
    'Ты не меняешь типы пунктов, не меняешь числа (target) и не добавляешь новых',
    'пунктов. Твоя работа — формулировки: переписать заголовки так, чтобы неделя',
    'читалась как связное занятие под цель ученика, и написать заметку ученику.',
    '',
    'Отвечай ТОЛЬКО валидным JSON без markdown:',
    '{',
    '  "note": "заметка ученику по-русски, 1-2 предложения: с чего начать и почему",',
    '  "items": [{"index": 0, "title": "новый заголовок пункта"}]',
    '}',
    '',
    'Жёсткие правила:',
    `1. index — номер пункта из списка ниже. Пунктов ровно ${items.length}, ни больше ни меньше.`,
    '2. Заголовок — по-русски, до 90 символов, конкретный и в повелительном наклонении.',
    `3. Числа из заголовков НЕ меняй: они посчитаны по правилам (не больше 10 новых слов в день, ${sessions} коротких захода за срок).`,
    '4. Пункты с пометкой «на выбор» — равноценные альтернативы, ученик сделает ОДИН. Не превращай их в «сначала одно, потом другое».',
    '5. В заметке НЕ пересказывай диагностику: ученик не должен читать про свои слабые места.',
  ].join('\n')

  const user = [
    f.goal ? `Цель ученика: ${GOAL_LABEL[f.goal] ?? f.goal}.` : 'Цель ученика не указана.',
    `Уровень: ${f.level ?? 'не измерен'}. Занимался ${f.activeDays14} дней из последних 14.`,
    '',
    'Набор (менять состав нельзя):',
    ...items.map(
      (it, i) =>
        `${i}. [${it.kind}${it.pickGroup != null ? ', на выбор' : ''}] ${it.title}` +
        (it.target && it.target > 1 ? ` (нужно ${it.target})` : '') +
        `\n   почему: ${it.why}`,
    ),
    brief,
  ]
    .filter(Boolean)
    .join('\n')

  return { system, user }
}

/**
 * Готовый набор для формы. Никогда не бросает из-за AI: если модель не
 * ответила, возвращаем набор с нашими формулировками и fromAi=false.
 */
export async function suggestHomework(
  studentId: string,
  lang: AppLang,
  level: string | null,
  days: number,
): Promise<Suggestion> {
  const facts = await collectFacts(studentId, lang, level, days)
  const baseline = applyRules(buildBaseline(facts), facts)
  const n = sessionsFor(days)
  const fallbackNote =
    `Делай короткими заходами — ${n} ${plural(n, 'раз', 'раза', 'раз')} за срок лучше, ` +
    'чем всё в один вечер. Из двух заданий «на выбор» сделай одно.'

  let brief = ''
  try {
    brief = await studentBriefBlock(studentId, lang)
  } catch {
    brief = ''
  }

  const { system, user } = suggestPrompt(facts, baseline, brief)
  let raw: string
  try {
    raw = await chat([{ role: 'user', content: user }], { system, task: 'homework' })
  } catch {
    return { items: baseline, note: fallbackNote, facts, fromAi: false }
  }

  const parsed = parseJson<{ note?: unknown; items?: { index?: unknown; title?: unknown }[] }>(raw)
  if (!parsed) return { items: baseline, note: fallbackNote, facts, fromAi: false }

  // Заголовки принимаем по одному: испорченный или лишний пункт не должен
  // утаскивать за собой весь набор — остальные формулировки в нём годные.
  const items = baseline.map((it) => ({ ...it }))
  for (const row of Array.isArray(parsed.items) ? parsed.items : []) {
    const i = Number(row?.index)
    const title = typeof row?.title === 'string' ? row.title.trim().slice(0, 90) : ''
    if (!Number.isInteger(i) || i < 0 || i >= items.length || !title) continue
    items[i]!.title = title
  }
  const note = typeof parsed.note === 'string' ? parsed.note.trim().slice(0, 300) : ''

  // ⚠️ Правила применяем ЕЩЁ РАЗ, уже к ответу модели. Заголовки она менять
  // может, а состав — нет, и проверяем мы это, а не верим на слово.
  return {
    items: applyRules(items, facts).slice(0, MAX_ITEMS),
    note: note || fallbackNote,
    facts,
    fromAi: true,
  }
}
