// ============================================================================
// Человеческий текст вместо технической ошибки supabase-js.
//
// Зачем отдельный модуль. Раньше 26 мест в src/lib делали
// `throw new Error(error.message)`, и наружу летело то, что написала
// библиотека. Живой случай: ученик отправлял работу при моргнувшей связи и
// видел «TypeError: Failed to fetch». Наша аудитория — репетиторы и
// школьники: такой текст не говорит ни что случилось, ни что делать, и
// человек просто уходит, не написав в поддержку.
//
// Почему здесь, а не в supabase.ts: там транспорт (клиент, requireUserId), а
// это — формулировки для человека, ими пользуются восемь разных модулей.
// Рядом уже лежит access.ts, который так же переводит ошибки входа от GoTrue;
// dbError — его сосед для ошибок базы, а не часть клиента.
//
// Правило: пользователю — что произошло и что делать дальше; техническая
// подробность НЕ проглатывается, а уходит в console.error, чтобы диагностика
// («открой консоль и покажи») осталась возможной.
// ============================================================================
import { SUPPORT_EMAIL } from './contacts'

/**
 * Форма ошибки supabase-js. PostgrestError — обычный объект (не Error!) с
 * полями message/code/details/hint; AuthError — настоящий Error. Сюда
 * укладываются оба, поэтому принимаем unknown и читаем поля осторожно.
 */
interface SupabaseErrorLike {
  message?: unknown
  code?: unknown
}

function readMessage(error: unknown): string {
  if (typeof error === 'string') return error
  const m = (error as SupabaseErrorLike | null)?.message
  return typeof m === 'string' ? m : ''
}

function readCode(error: unknown): string {
  const c = (error as SupabaseErrorLike | null)?.code
  return typeof c === 'string' ? c : ''
}

/** Наши собственные коды из RPC (docs/schema.sql) → текст для человека. */
const RECALL_TEXTS: Record<string, (action: string) => string> = {
  RECALL_NO_AUTH: (action) =>
    `Похоже, ты вышел из аккаунта — не получилось ${action}. Зайди заново и повтори.`,
  RECALL_BLOCKED: (action) =>
    `Аккаунт приостановлен, поэтому не получилось ${action}. Напиши на ${SUPPORT_EMAIL}.`,
  RECALL_NOT_ADMIN: () => 'Это может только владелец приложения.',
  RECALL_BAD_PLAN: () => 'Такого тарифа нет — выбери другой.',
  RECALL_NOT_YOUR_STUDENT: () => 'Этот ученик к тебе не привязан.',
  RECALL_SEATS_FULL: () =>
    'Свободных мест по тарифу нет — освободи одно или расширь тариф.',
}

/**
 * Похоже ли, что текст написан нами для человека. Многие наши RPC поднимают
 * исключения по-русски и по делу («Код не найден. Проверь код у преподавателя.»,
 * «Работа не найдена или уже сдана.») — такой текст полезнее любого общего,
 * и заменять его нельзя.
 *
 * Одной кириллицы мало: в сообщении Postgres может оказаться русское значение
 * поля («duplicate key … (title)=(Мой текст)»), поэтому технические обороты
 * дисквалифицируют строку.
 */
function looksHumanRu(message: string): boolean {
  if (!/[а-яё]/i.test(message)) return false
  return !/(violates|constraint|relation |column |syntax|does not exist|permission denied|row-level|duplicate key)/i.test(
    message,
  )
}

/**
 * Текст ошибки для пользователя. Чистая функция: ничего не логирует и не
 * бросает — удобно проверять отдельно.
 *
 * `action` — что человек пытался сделать, в инфинитиве и от его лица:
 * «отправить работу», «загрузить задания». Он подставляется в предложение,
 * поэтому без заглавной буквы и без точки.
 *
 * Причину не выдумываем: если тип ошибки не опознан, текст честно общий.
 */
export function describeDbError(error: unknown, action: string): string {
  const message = readMessage(error)
  const lower = message.toLowerCase()
  const code = readCode(error)

  // 1. Наши коды — они точнее всех остальных признаков
  for (const [marker, text] of Object.entries(RECALL_TEXTS)) {
    if (message.includes(marker)) return text(action)
  }

  // 2. Наш же русский текст из RPC — отдаём как есть, он точнее общего
  if (looksHumanRu(message)) return message

  // 3. Нет сети. postgrest-js в этом случае отдаёт message вида
  // «TypeError: Failed to fetch» (Chrome), «NetworkError…» (Firefox),
  // «Load failed» (Safari) — именно это и видел ученик.
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower.includes('fetcherror')
  ) {
    return `Похоже, пропал интернет — не получилось ${action}. Проверь связь и попробуй ещё раз.`
  }

  // 4. RPC нет в базе: миграцию не залили, а клиент уже обновился.
  // Пользователь тут бессилен — чинить нам, поэтому зовём написать.
  if (code === 'PGRST202' || lower.includes('could not find the function')) {
    return `Не получилось ${action}: обновление приложения ещё не применилось на сервере. Это на нашей стороне — напиши на ${SUPPORT_EMAIL}.`
  }

  // 5. Протухшая сессия — лечится повторным входом, а не поддержкой
  if (
    code === 'PGRST301' ||
    lower.includes('jwt expired') ||
    lower.includes('invalid claim') ||
    lower.includes('jwt is missing')
  ) {
    return `Похоже, ты вышел из аккаунта — не получилось ${action}. Зайди заново и повтори.`
  }

  // 6. Отказ прав: RLS не пустила к чужим (или уже не своим) данным.
  // Частая житейская причина — преподаватель отвязал ученика, — но
  // утверждать её мы не можем, поэтому говорим только факт.
  if (
    code === '42501' ||
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('policy')
  ) {
    return `Не получилось ${action}: у твоего аккаунта нет доступа к этим данным. Если доступ должен быть, напиши на ${SUPPORT_EMAIL}.`
  }

  // 7. Всё остальное — честно общий текст с понятным следующим шагом
  return `Не получилось ${action}. Попробуй ещё раз — если повторится, напиши на ${SUPPORT_EMAIL}.`
}

/**
 * Ошибка supabase-js → Error с человеческим текстом (его и покажет экран:
 * везде в интерфейсе стоит `e instanceof Error ? e.message : …`).
 * Техническая подробность уходит в консоль, а не пропадает.
 *
 * Использовать так: `if (error) throw dbError(error, 'отправить работу')`.
 */
export function dbError(error: unknown, action: string): Error {
  console.error(`[db] не удалось ${action}:`, error)
  return new Error(describeDbError(error, action))
}
