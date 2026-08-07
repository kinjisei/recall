// ============================================================================
// AI-оценка письма (Заход 5b): структурный JSON (для показа ученику и по-строчной
// проверки учителем в 5c). Два режима — IELTS (band + 4 критерия) и обычный
// (уровень + чек-листы целевых слов/грамматики). Оба: список ошибок (было→стало),
// сильные стороны, что подтянуть, 1-2 rewrites. task 'writing' (heavy).
// ============================================================================
import { chat } from './gemini'
import type { AppLang, WritingGrade, WritingTask } from '../types'

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function asStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(asStr).filter(Boolean) : []
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && isFinite(v) ? v : undefined
}

/** Санитайз ответа модели в WritingGrade (не доверяем форме). */
function parseGrade(raw: string, mode: 'ielts' | 'regular'): WritingGrade {
  const s = raw.indexOf('{')
  const e = raw.lastIndexOf('}')
  if (s === -1 || e <= s) throw new Error('AI вернул не-JSON. Попробуй ещё раз.')
  const o = JSON.parse(raw.slice(s, e + 1)) as Record<string, unknown>

  const errors = (Array.isArray(o.errors) ? o.errors : [])
    .map((x) => {
      const it = (x ?? {}) as Record<string, unknown>
      return { was: asStr(it.was), fix: asStr(it.fix), type: asStr(it.type) || undefined }
    })
    .filter((x) => x.was && x.fix)
    .slice(0, 30)
  const rewrites = (Array.isArray(o.rewrites) ? o.rewrites : [])
    .map((x) => {
      const it = (x ?? {}) as Record<string, unknown>
      return { was: asStr(it.was), better: asStr(it.better) }
    })
    .filter((x) => x.was && x.better)
    .slice(0, 3)

  const grade: WritingGrade = {
    errors,
    rewrites,
    strengths: asStrArr(o.strengths).slice(0, 6),
    improve: asStrArr(o.improve).slice(0, 6),
    topics: asStrArr(o.topics).slice(0, 8),
    words: asStrArr(o.words).slice(0, 12),
  }

  if (mode === 'ielts') {
    grade.band = num(o.band)
    const c = (o.criteria ?? {}) as Record<string, unknown>
    grade.criteria = {
      task: num(c.task) ?? 0,
      coherence: num(c.coherence) ?? 0,
      lexis: num(c.lexis) ?? 0,
      grammar: num(c.grammar) ?? 0,
    }
  } else {
    grade.level = asStr(o.level)
    grade.targetWords = (Array.isArray(o.targetWords) ? o.targetWords : [])
      .map((x) => {
        const it = (x ?? {}) as Record<string, unknown>
        return { w: asStr(it.w), used: Boolean(it.used) }
      })
      .filter((x) => x.w)
    grade.targetGrammar = (Array.isArray(o.targetGrammar) ? o.targetGrammar : [])
      .map((x) => {
        const it = (x ?? {}) as Record<string, unknown>
        return { t: asStr(it.t), used: Boolean(it.used) }
      })
      .filter((x) => x.t)
  }
  return grade
}

/** Итоговая метка для колонки band: IELTS — число, обычный — уровень. */
export function bandLabel(mode: 'ielts' | 'regular', grade: WritingGrade): string {
  if (mode === 'ielts') return grade.band != null ? String(grade.band) : ''
  return grade.level ?? ''
}

export async function gradeWriting(
  task: WritingTask,
  essay: string,
  lang: AppLang,
): Promise<WritingGrade> {
  if (task.mode === 'ielts') {
    const chart = task.settings?.chart
    const academic = task.settings?.ieltsTask === 'academic1' && chart
    const kind = academic
      ? 'Academic Task 1 (описание графика/данных)'
      : task.settings?.ieltsTask === 'gt1'
        ? 'General Training Task 1 (письмо)'
        : 'Task 2 (эссе)'
    const system = [
      `Ты — экзаменатор IELTS. Оцени работу ученика (${kind}).`,
      academic
        ? 'Это Academic Task 1: ученик описывает данные графика. Данные графика даны тебе НИЖЕ в JSON — сверяй по ним факты. Оценивай: есть ли обзор (overview) главных тенденций, выделены ли ключевые особенности, ТОЧНЫ ли числа и сравнения, нет ли лишних мнений/причин. Ошибка в данных (неверная цифра/тренд) — это ошибка Task Achievement.'
        : '',
      'Верни ТОЛЬКО валидный JSON без markdown:',
      '{"band":0-9,"criteria":{"task":0-9,"coherence":0-9,"lexis":0-9,"grammar":0-9},' +
        '"errors":[{"was":"цитата из текста","fix":"исправление","type":"grammar|vocab|spelling"}],' +
        '"strengths":["сильная сторона"],"improve":["что подтянуть"],' +
        '"topics":["тема грамматики для повторения"],"words":["полезное слово"],' +
        '"rewrites":[{"was":"слабое предложение","better":"улучшенный вариант"}]}',
      'band и criteria — по шкале 0-9 (допускается .5). Считай РЕАЛЬНЫЕ ошибки, не выдумывай.',
      'errors — конкретные цитаты из текста ученика и их исправления. strengths/improve/topics/words/rewrites — по-русски там, где это пояснение; сами английские слова/фразы — на английском.',
    ]
      .filter(Boolean)
      .join('\n')
    const user = [
      `Вопрос задания:\n${task.prompt}`,
      academic ? `\nДанные графика (JSON):\n${JSON.stringify(chart)}` : '',
      `\nОтвет ученика:\n${essay}`,
    ].join('\n')
    const raw = await chat([{ role: 'user', content: user }], { system, task: 'writing' })
    return parseGrade(raw, 'ielts')
  }

  // обычный режим
  const subject = lang === 'es' ? 'испанского' : 'английского'
  const words = task.settings?.targetWords ?? []
  const grammar = task.settings?.targetGrammar ?? []
  const system = [
    `Ты — преподаватель ${subject}. Оцени письменную работу ученика (уровень ${task.level}).`,
    words.length ? `Целевые слова, которые ученик должен был употребить: ${words.join(', ')}.` : 'Целевые слова не заданы.',
    grammar.length ? `Целевая грамматика: ${grammar.join(', ')}.` : 'Целевая грамматика не задана.',
    'Верни ТОЛЬКО валидный JSON без markdown:',
    '{"level":"A1..C1 — уровень текста","targetWords":[{"w":"слово","used":true|false}],' +
      '"targetGrammar":[{"t":"структура","used":true|false}],' +
      '"errors":[{"was":"цитата","fix":"исправление","type":"grammar|vocab|spelling"}],' +
      '"strengths":["сильная сторона"],"improve":["что подтянуть"],' +
      '"topics":["тема для повторения"],"words":["полезное слово"],' +
      '"rewrites":[{"was":"слабое предложение","better":"лучше"}]}',
    'targetWords/targetGrammar — по КАЖДОМУ целевому слову/структуре из списков выше: реально ли ученик его употребил (used). Ошибки реальные, не выдумывай. Пояснения по-русски, целевые слова/фразы — на изучаемом языке.',
  ].join('\n')
  const raw = await chat([{ role: 'user', content: `Задание:\n${task.prompt}\n\nТекст ученика:\n${essay}` }], {
    system,
    task: 'writing',
  })
  return parseGrade(raw, 'regular')
}
