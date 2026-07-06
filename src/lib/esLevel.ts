// ============================================================================
// Уровень испанского пользователя (результат placement-теста).
// Храним в localStorage — как и выбор языка; своей колонки в БД не заводим.
// ============================================================================
import type { CEFRLevel } from '../types'

const KEY = 'recall.es_level'

const VALID: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/** Сохранённый уровень испанского, либо null (тест ещё не пройден). */
export function getEsLevel(): CEFRLevel | null {
  try {
    const v = localStorage.getItem(KEY)
    return v && (VALID as string[]).includes(v) ? (v as CEFRLevel) : null
  } catch {
    return null
  }
}

export function setEsLevel(level: CEFRLevel): void {
  try {
    localStorage.setItem(KEY, level)
  } catch {
    /* приватный режим — не критично */
  }
}
