// ============================================================================
// Выделение фразы в читалке (зажать+провести): ДЕШЁВЫЙ перевод всего выделенного
// (умный разбор — отдельно, за кнопкой). Плюс порог, когда предлагать разбор.
// ============================================================================
import { chat } from './gemini'
import type { AppLang } from '../types'

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Дешёвый перевод всей выделенной фразы в контексте предложения. '' при сбое. */
export async function translatePhrase(
  phrase: string,
  sentence: string,
  lang: AppLang,
): Promise<string> {
  const dict = lang === 'es' ? 'испанского' : 'английского'
  const system = [
    `Ты — словарь ${dict} для русскоязычного ученика.`,
    'Переведи фразу в контексте предложения. Верни ТОЛЬКО JSON {"translation":"…"} —',
    'короткий естественный перевод (фразовые глаголы по смыслу, не буквально). Ничего кроме JSON.',
  ].join('\n')
  const user = JSON.stringify({ phrase, sentence })
  try {
    const raw = await chat([{ role: 'user', content: user }], { system, task: 'word' })
    const s = raw.indexOf('{')
    const e = raw.lastIndexOf('}')
    if (s === -1 || e <= s) return ''
    const o = JSON.parse(raw.slice(s, e + 1)) as Record<string, unknown>
    return asStr(o.translation)
  } catch {
    return ''
  }
}
