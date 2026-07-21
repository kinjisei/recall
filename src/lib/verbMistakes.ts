// ============================================================================
// Банк ошибок тренажёров глаголов (EN неправильные / ES спряжения). Формат
// упражнений там свой, отличный от грамматических уроков, поэтому у них
// отдельный банк. Ошибка кладёт id глагола/упражнения сюда, верный ответ
// убирает; в тренажёре появляется группа «Мои ошибки», гоняющая только их.
// Всё в localStorage — как и грамматический банк ([[mistakes]]).
// ============================================================================
import type { AppLang } from '../types'

const key = (lang: AppLang) => `recall.verb_mistakes.${lang}`

export function getVerbMistakes(lang: AppLang): string[] {
  try {
    const raw = localStorage.getItem(key(lang))
    const list = raw ? (JSON.parse(raw) as string[]) : []
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function save(lang: AppLang, list: string[]): void {
  try {
    localStorage.setItem(key(lang), JSON.stringify(list))
  } catch {
    /* приватный режим — просто не сохранится */
  }
}

export function addVerbMistake(lang: AppLang, id: string): void {
  const list = getVerbMistakes(lang)
  if (list.includes(id)) return
  save(lang, [...list, id])
}

export function removeVerbMistake(lang: AppLang, id: string): void {
  save(lang, getVerbMistakes(lang).filter((x) => x !== id))
}
