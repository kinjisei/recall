// ============================================================================
// Единый безопасный доступ к localStorage. Раньше паттерн getItem→JSON.parse с
// try/catch был переписан в десятке модулей, и поведение при сбое разъехалось
// (где-то возвращалось {}, где-то [], где-то бросало исключение). Теперь одна
// точка: приватный режим, переполнение и битый JSON всегда дают fallback, а не
// роняют экран. Форму данных (Array.isArray и т.п.) проверяет вызывающий.
// ============================================================================

/** Прочитать и распарсить JSON; на отсутствие/ошибку/битый JSON — fallback. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

/** Сохранить значение как JSON. Сбой (приватный режим/переполнение) глотается. */
export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* приватный режим / переполнение — некритично */
  }
}

/** Прочитать строку как есть; на ошибку — null. */
export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Записать строку как есть; сбой глотается. */
export function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* некритично */
  }
}
