// ============================================================================
// Несколько источников одного экрана — с пределом ожидания (PLAN.md Ф1.13).
//
// Зачем. Экран, который ждёт несколько запросов разом (Главная, «Учёба»,
// «Прогресс»), без сети или на зависшей связи либо висел на серых заглушках,
// либо рисовал «0» и «пусто» вместо «не загрузилось». Клиент Supabase на
// сетевой ошибке сам повторяет чтение (1 + 2 + 4 с), а зависший запрос не
// падает вовсе — поэтому ждём не дольше LOAD_TIMEOUT_MS и честно отдаём, что
// пришло, а что нет. Решать, что из этого сказать человеку, — экрану.
//
// Модуль без импортов: его проверяет чистый тест scripts/test-connection.mjs.
// ============================================================================

/** Сколько ждать ответа, прежде чем сказать «похоже, пропала связь». */
export const LOAD_TIMEOUT_MS = 12_000

/** Сервер не ответил за отведённое время (shared/api/connection узнаёт его по имени). */
export class LoadTimeoutError extends Error {
  constructor() {
    super('Сервер долго не отвечает')
    this.name = 'LoadTimeoutError'
  }
}

/** Обещание, которое не ждёт дольше ms: не успело — LoadTimeoutError. */
export function withTimeout<T>(promise: Promise<T>, ms = LOAD_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LoadTimeoutError()), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** Источники экрана: имя → загрузка. Тип значения выводится из каждой функции. */
export type Sources<T> = { [K in keyof T]: () => Promise<T[K]> }

export interface SettledAll<T> {
  /** Что пришло; не пришедшее (упало или не успело) — null. */
  values: { [K in keyof T]: T[K] | null }
  /** Какие источники не ответили (упали или не успели). */
  failed: (keyof T)[]
}

/**
 * Запускает все источники разом и ждёт каждый не дольше ms. Никогда не
 * падает сама: упавший источник попадает в failed, остальные — в values.
 */
export async function settleAll<T extends Record<string, unknown>>(
  sources: Sources<T>,
  ms = LOAD_TIMEOUT_MS,
): Promise<SettledAll<T>> {
  const keys = Object.keys(sources) as (keyof T)[]
  // через then: источник, бросивший синхронно, тоже станет «упал», а не уронит всё
  const results = await Promise.allSettled(keys.map((k) => withTimeout(Promise.resolve().then(sources[k]), ms)))
  const values = {} as SettledAll<T>['values']
  const failed: (keyof T)[] = []
  keys.forEach((key, i) => {
    const r = results[i]
    if (r?.status === 'fulfilled') {
      values[key] = r.value as T[typeof key]
    } else {
      values[key] = null
      failed.push(key)
    }
  })
  return { values, failed }
}
