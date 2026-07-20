// ============================================================================
// Банк ошибок грамматики: упражнения, где пользователь ошибся, копятся в
// localStorage и доступны повторным раундом «Мои ошибки» на экране грамматики.
// Верный ответ (в обычном уроке или в повторе) убирает упражнение из банка.
// В БД не пишем: это личная локальная «работа над ошибками», как настройки.
// ============================================================================
import type { AppLang } from '../types'

export interface GrammarMistake {
  topicId: number
  /** Индекс упражнения внутри темы. */
  ex: number
}

const key = (lang: AppLang) => `recall.grammar_mistakes.${lang}`

export function getMistakes(lang: AppLang): GrammarMistake[] {
  try {
    const raw = localStorage.getItem(key(lang))
    const list = raw ? (JSON.parse(raw) as GrammarMistake[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function save(lang: AppLang, list: GrammarMistake[]): void {
  try {
    localStorage.setItem(key(lang), JSON.stringify(list))
  } catch {
    /* приватный режим и т.п. — банк просто не сохранится */
  }
}

export function addMistake(lang: AppLang, m: GrammarMistake): void {
  const list = getMistakes(lang)
  if (list.some((x) => x.topicId === m.topicId && x.ex === m.ex)) return
  save(lang, [...list, m])
}

export function removeMistake(lang: AppLang, m: GrammarMistake): void {
  save(
    lang,
    getMistakes(lang).filter((x) => !(x.topicId === m.topicId && x.ex === m.ex)),
  )
}
