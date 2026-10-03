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
// Почему отдельно от supabase.ts: там транспорт (клиент, requireUserId), а
// это — формулировки для человека, ими пользуются восемь разных модулей.
// Ошибки входа от GoTrue так же переводит lib/access.ts; этот файл — его
// сосед по смыслу для ошибок базы, а не часть клиента.
//
// Правило: пользователю — что произошло и что делать дальше; техническая
// подробность НЕ проглатывается, а уходит в console.error, чтобы диагностика
// («открой консоль и покажи») осталась возможной.
// ============================================================================
import { SUPPORT_EMAIL } from '../lib/contacts.ts'
import { NETWORK_CODE, NETWORK_MESSAGE } from './connection.ts'

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

/** Наши собственные коды из RPC (supabase/migrations) → текст для человека. */
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
  // без тарифа после пробного расписание и карточки — только просмотр (журнал п.41, макет t9-3)
  RECALL_PLAN_REQUIRED: () =>
    'Тариф закончился: расписание и ученики — только для просмотра. Продли тариф, и всё снова заработает.',
  RECALL_NOT_TEACHER: () => 'Это доступно в режиме преподавателя.',
  // карточки учеников (миграция 0008)
  RECALL_CARD_NAME: () => 'Впиши имя ученика.',
  RECALL_CARD_NOT_FOUND: () => 'Карточка не найдена — обнови список.',
  RECALL_BAD_STATUS: () => 'Такого статуса нет — обнови страницу.',
  RECALL_CARD_ARCHIVED: () => 'Ученик в архиве — сначала верни его из архива.',
  RECALL_CARD_IN_APP: () => 'Ученик уже в приложении.',
  RECALL_CARD_NO_SEAT: () => 'Пробный ученик и ученик в архиве место тарифа не занимают.',
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
  if (NETWORK_MESSAGE.test(message)) {
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
export function dbError(error: unknown, action: string): AppError {
  console.error(`[db] не удалось ${action}:`, error)
  return new AppError(describeDbError(error, action), errorCode(error))
}

/**
 * Ошибка приложения: `message` — текст для человека (его показывает экран, как
 * и у обычного Error), `code` — причина для кода: наш RECALL_* из RPC или код
 * supabase-js/Postgres (PGRST301, 42501…). По коду можно решать, что делать
 * (повторить, позвать войти заново), не разбирая русский текст.
 *
 * Наследник Error: `instanceof Error`, `message` и `name` те же, что раньше, —
 * все места с `e instanceof Error ? e.message : …` работают как прежде.
 */
export class AppError extends Error {
  readonly code: string | undefined

  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

/**
 * Код причины: наш маркер RECALL_* точнее кода библиотеки. Нет сети — NETWORK:
 * текст ошибки уже переведён, и isConnectionError узнаёт сбой связи по коду
 * (раньше AppError из-за сети для него была «не связью»).
 */
function errorCode(error: unknown): string | undefined {
  const message = readMessage(error)
  const ours = Object.keys(RECALL_TEXTS).find((marker) => message.includes(marker))
  if (ours) return ours
  if (NETWORK_MESSAGE.test(message)) return NETWORK_CODE
  return readCode(error) || undefined
}
