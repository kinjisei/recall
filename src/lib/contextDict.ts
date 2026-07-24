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
  // выделили несколько слов — переводим выражение целиком, а не по словам
  const isPhrase = word.trim().split(/\s+/).length > 1

  const system = isPhrase
    ? [
        `Ты — умный словарь ${langName} языка: переводишь ВЫРАЖЕНИЕ с учётом контекста.`,
        'Отвечай ТОЛЬКО валидным JSON без markdown:',
        '{"base":"выражение в словарной форме","translation":"перевод выражения ЦЕЛИКОМ, по-русски","note":"пояснение или пустая строка"}',
        '',
        'Правила:',
        '- переводи выражение как единое целое, а не слово за словом: «make up my mind» → «принять решение», «run out of» → «закончиться»;',
        '- base: та же фраза в словарной форме (глагол в инфинитиве, местоимения-заполнители как sb/sth): «made up his mind» → «make up one’s mind»;',
        '- translation: естественный русский перевод именно в этом предложении;',
        '- note: если это устойчивое выражение, фразовый глагол или идиома — коротко объясни смысл по-русски; иначе "";',
        '- пиши просто, как для начинающего: без лингвистических терминов и энциклопедичности.',
      ].join('\n')
    : [
        `Ты — умный словарь ${langName} языка: переводишь слово с учётом контекста.`,
        'Отвечай ТОЛЬКО валидным JSON без markdown:',
        '{"base":"начальная форма слова","translation":"перевод в ЭТОМ контексте, по-русски, кратко","note":"пояснение или пустая строка"}',
        '',
        'Правила:',
        '- base: для глагольных форм — инфинитив (went → go, is → be), для существительных — единственное число;',
        '- translation: значение, в котором слово употреблено В ПРЕДЛОЖЕНИИ. Пример: will как вспомогательный глагол будущего — «будет (вспомогательный глагол)», а не «завещание»; is — «есть, является (глагол-связка)»;',
        '- note: одно предложение по-русски, если слово служебное, часть устойчивого выражения или употреблено в переносном смысле — что оно значит именно здесь; иначе "";',
        '- пиши просто, как для начинающего: без лингвистических терминов и энциклопедичности.',
      ].join('\n')

  const raw = await chat(
    [
      {
        role: 'user',
        content: `${isPhrase ? 'Выражение' : 'Слово'}: «${word}»\nПредложение: «${sentence}»`,
      },
    ],
    { system, task: 'word' }, // перевод слова — сервер даст мини-модель
  )
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('Словарь AI вернул не-JSON')
  let parsed: ContextLookup
  try {
    parsed = JSON.parse(raw.slice(start, end + 1)) as ContextLookup
  } catch {
    throw new Error('Словарь AI вернул повреждённый JSON')
  }
  if (!parsed.translation) throw new Error('Пустой перевод')

  const result: ContextLookup = {
    base: parsed.base || word,
    translation: parsed.translation,
    note: parsed.note ?? '',
  }
  // ограничиваем кэш, чтобы память не росла бесконечно за долгую сессию
  if (cache.size >= 300) cache.delete(cache.keys().next().value as string)
  cache.set(key, result)
  return result
}
