// ============================================================================
// «Почему?» в разборе результатов практики: короткое объяснение ошибки от AI
// по запросу (дешёвая модель, task 'word'). Кэш в памяти на сессию — повторный
// тап по тому же вопросу не тратит лимит.
// ============================================================================
import { chat } from './gemini'
import type { AppLang } from '../types'

const cache = new Map<string, string>()

export async function explainMistake(
  prompt: string,
  given: string,
  correct: string,
  lang: AppLang,
): Promise<string> {
  const key = `${lang}|${prompt}|${given}|${correct}`
  const hit = cache.get(key)
  if (hit) return hit

  const langName = lang === 'es' ? 'испанского' : 'английского'
  const system = [
    `Ученик учит ${langName} язык. Объясни его ошибку.`,
    'Ответь по-русски коротко и просто (2-3 предложения): почему верный вариант правильный,',
    'а вариант ученика — нет. Без лингвистических терминов. Только текст объяснения, без кавычек.',
  ].join(' ')
  const user = `Вопрос: «${prompt}»\nОтвет ученика: «${given}»\nВерный ответ: «${correct}»`
  const raw = await chat([{ role: 'user', content: user }], { system, task: 'word' })
  const text = raw.trim()
  if (cache.size >= 200) cache.delete(cache.keys().next().value as string)
  cache.set(key, text)
  return text
}
