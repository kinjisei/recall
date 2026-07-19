// ============================================================================
// Контекстный словарь: перевод слова В КОНТЕКСТЕ предложения через Gemini.
// Обычные словари дают значение без контекста (will → «завещание»), поэтому
// перевод берём у AI, а словарное API остаётся для транскрипции/аудио (EN).
// ============================================================================
import { chat } from './gemini'
import type { AppLang } from '../types'

export interface ContextLookup {
  base: string // начальная (словарная) форма
  translation: string // перевод именно в данном контексте
  note: string // пояснение (служебное слово / идиома / переносный смысл) или ''
}

const cache = new Map<string, ContextLookup>()

export async function lookupInContext(
  word: string,
  sentence: string,
  lang: AppLang,
): Promise<ContextLookup> {
  const key = `${lang}|${word.toLowerCase()}|${sentence}`
  const hit = cache.get(key)
  if (hit) return hit

  const langName = lang === 'es' ? 'испанского' : 'английского'
  const system = [
    `Ты — умный словарь ${langName} языка: переводишь слово с учётом контекста.`,
    'Отвечай ТОЛЬКО валидным JSON без markdown:',
    '{"base":"начальная форма слова","translation":"перевод в ЭТОМ контексте, по-русски, кратко","note":"пояснение или пустая строка"}',
    '',
    'Правила:',
    '- base: для глагольных форм — инфинитив (went → go, is → be), для существительных — единственное число;',
    '- translation: значение, в котором слово употреблено В ПРЕДЛОЖЕНИИ. Пример: will как вспомогательный глагол будущего — «будет (вспомогательный глагол)», а не «завещание»; is — «есть, является (глагол-связка)»;',
    '- note: одно предложение по-русски, если слово служебное, часть устойчивого выражения или употреблено в переносном смысле — что оно значит именно здесь; иначе "".',
  ].join('\n')

  const raw = await chat(
    [{ role: 'user', content: `Слово: «${word}»\nПредложение: «${sentence}»` }],
    { system, light: true }, // лёгкая модель: отдельная (бо́льшая) дневная квота
  )
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('Словарь AI вернул не-JSON')
  const parsed = JSON.parse(raw.slice(start, end + 1)) as ContextLookup
  if (!parsed.translation) throw new Error('Пустой перевод')

  const result: ContextLookup = {
    base: parsed.base || word,
    translation: parsed.translation,
    note: parsed.note ?? '',
  }
  cache.set(key, result)
  return result
}
