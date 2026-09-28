// ============================================================================
// Сроки ожидания для запросов из api/ к внешним сервисам (PLAN.md Ф1.10).
// Файл с «_» — Vercel НЕ делает из него отдельную функцию.
//
// Зачем. 27.09.2026 сторож прода получил 504: поставщик AI завис, а у наших
// запросов не было ограничения времени. Функция ждала, пока Vercel не оборвёт
// её на maxDuration, и в итоге запасные модели не спрошены, на экране ошибка, а
// энергия НЕ вернулась: возврат стоит в обработке ошибок, до которой оборванная
// функция не доходит.
//
// Правила:
//   • каждый запрос наружу — только через timedFetch/openStream (голый fetch
//     в api/ ловит scripts/test-ai-timeouts.mjs);
//   • зависшая модель = отказ, как 429: цепочка идёт к следующей;
//   • вся работа функции кончается к workDeadline — после него остаётся время
//     ровно на возврат энергии и запас.
// Числа — оценки без замеров. С Ф1.6 задержки пишутся (ai_call_log: latency_ms,
// попытки с ms и first — первые слова потока), сводка — /admin, блок «Расход
// AI»: набрались замеры — сверить окна с ними.
// ============================================================================
import type { AiTier } from './_core.js'

/** Сроки ожидания, мс. Параметр, а не зашитые числа: тест гоняет те же пути за доли секунды. */
export interface Timeouts {
  /** maxDuration функции: через столько Vercel её оборвёт. */
  functionMs: number
  /** Запас на всё, что не запросы: холодный старт, разбор JSON, отправка ответа. */
  safetyMs: number
  /** Один запрос в Supabase — списание, возврат энергии, проверка роли. */
  supabaseMs: number
  /** Запись итога удачного вызова в журнал (api/_usage.ts): ответ уже готов и ждёт её. */
  logMs: number
  /** Groq — последний рубеж после цепочки Gemini (70b, до 1024 токенов). */
  groqMs: number
  /** Распознавание речи (Whisper, запись до 3 МБ). */
  sttMs: number
  /** Одна попытка — один запрос к одной модели — по уровню задачи. */
  attemptMs: Record<AiTier, number>
  /** Меньше этого окна попытку не начинаем: не успеет, а квоту модели съест. */
  minAttemptMs: number
  /** Поток «Диалога»: сколько ждём первых слов, потом — следующая модель. */
  firstTextMs: number
  /** Поток: пауза между кусками, после которой считаем, что он оборвался. */
  idleMs: number
}

/** Сроки прода без functionMs — его даёт config.maxDuration каждой функции. */
export const TIMEOUTS: Omit<Timeouts, 'functionMs'> = {
  safetyMs: 3_000,
  // PostgREST обычно отвечает за 0,1–0,5 с; 5 с — десятикратный запас, и
  // списание с возвратом вместе занимают не больше шестой части минуты.
  supabaseMs: 5_000,
  // Готовый ответ ждёт записи в журнал — зависшая база не должна держать его
  // дольше полутора секунд: без строки журнала обойдёмся, без ответа — нет.
  logMs: 1_500,
  // 1024 токена у Groq-70b — около 4 с; втрое — на очередь бесплатного тарифа.
  groqMs: 12_000,
  // Whisper на Groq разбирает фразу за доли секунды, основное — загрузка до
  // 3 МБ. 15 с с запасом, и вместе со списанием и возвратом влезает в 30 с.
  sttMs: 15_000,
  attemptMs: {
    // перевод слова отвечает за 1–3 с; дольше тап по слову уже никто не ждёт
    lite: 8_000,
    // Диалог — секунды; разбор письма (до 4096 токенов с «размышлениями») —
    // до ~20 с. Меньше 25 резать нельзя, больше — второй модели не останется
    // времени (цепочка кончается на 40-й секунде, см. gemini.ts)
    standard: 25_000,
    // материал на Pro-модели — 10–20 с. Окно почти во всю цепочку: при
    // зависании следующей Pro-модели времени всё равно не хватит, а медленный,
    // но настоящий ответ резать жалко
    max: 35_000,
  },
  minAttemptMs: 3_000,
  // первые слова Диалога приходят через 1–3 с, «размышляющим» моделям нужно
  // больше; три модели по 15 с укладываются в минуту вместе с возвратом
  firstTextMs: 15_000,
  // между кусками потока — доли секунды; 10 с тишины — обрыв
  idleMs: 10_000,
}

/** Сроки одной цепочки моделей (callGemini / streamGemini в _core). */
export interface ChainTime {
  /** Окно одной попытки обычного запроса. */
  attemptMs: number
  /** Поток: окно до первых слов модели. */
  firstTextMs: number
  /** Поток: пауза между кусками, после которой он считается оборванным. */
  idleMs: number
  minAttemptMs: number
  /** Общий срок цепочки (отметка Date.now()): после него новых попыток нет. */
  deadline: number
}

/** Сроки цепочки уровня tier. Без deadline — только окна попыток (так зовёт dev). */
export function chainTime(
  t: Omit<Timeouts, 'functionMs'>,
  tier: AiTier,
  deadline = Infinity,
): ChainTime {
  return {
    attemptMs: t.attemptMs[tier],
    firstTextMs: t.firstTextMs,
    idleMs: t.idleMs,
    minAttemptMs: t.minAttemptMs,
    deadline,
  }
}

/** Срок ответа вышел — поставщик не ответил в своё окно. */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`нет ответа за ${ms} мс`)
    this.name = 'TimeoutError'
  }
}

/**
 * До какой отметки (Date.now()) может идти работа функции. После неё остаются
 * один запрос в Supabase — итог вызова вместе с возвратом энергии
 * (api/_usage.ts) — и запас safetyMs.
 */
export function workDeadline(startedAt: number, t: Timeouts): number {
  return startedAt + t.functionMs - t.safetyMs - t.supabaseMs
}

/** Окно следующего запроса: своё, но не дальше общего срока. 0 — времени нет. */
export function windowUntil(deadline: number, capMs: number): number {
  return Math.max(0, Math.min(capMs, deadline - Date.now()))
}

/**
 * Ждёт promise не дольше ms. По истечении зовёт onTimeout (рвёт соединение)
 * и бросает TimeoutError. Гонка, а не только сигнал отмены: срок держится,
 * даже если кто-то по дороге отмену не услышит.
 */
export function within<T>(promise: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.()
      reject(new TimeoutError(ms))
    }, ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Запрос, который ждёт не дольше ms — и ответа, и тела: read получает ответ и
 * дочитывает тело ВНУТРИ окна (зависнуть можно и на середине тела). Бросает
 * TimeoutError по сроку и обычную ошибку при сбое связи.
 */
export function timedFetch<T>(
  url: string,
  init: RequestInit,
  ms: number,
  read: (res: Response) => Promise<T>,
): Promise<T> {
  const ctrl = new AbortController()
  return within(
    fetch(url, { ...init, signal: ctrl.signal }).then(read),
    ms,
    () => ctrl.abort(),
  )
}

/**
 * Потоковый запрос: ждёт заголовки не дольше ms. Куски дальше читает
 * вызывающий — каждый через within со своим окном; abort рвёт соединение.
 */
export async function openStream(
  url: string,
  init: RequestInit,
  ms: number,
): Promise<{ res: Response; abort: () => void }> {
  const ctrl = new AbortController()
  const abort = () => ctrl.abort()
  const res = await within(fetch(url, { ...init, signal: ctrl.signal }), ms, abort)
  return { res, abort }
}
