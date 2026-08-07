import { supabase } from './supabase'

/**
 * Контроль доступа: белый список приглашённых + флаг блокировки.
 * Оба механизма живут в БД (docs/schema.sql, блок «КОНТРОЛЬ ДОСТУПА»),
 * здесь только чтение состояния и человеческие формулировки ошибок.
 * Подробности и команды управления — docs/ACCESS-CONTROL.md
 */

/**
 * Маркер, которым триггер handle_new_user отклоняет незваный email.
 * Supabase Auth не всегда пробрасывает текст исключения из триггера наружу —
 * при ошибке в БД GoTrue отдаёт обобщённое «Database error saving new user».
 * Поэтому ловим и маркер, и обобщённую формулировку.
 */
const NOT_INVITED_MARKER = 'RECALL_NOT_INVITED'

const NOT_INVITED_TEXT =
  'Этот адрес не в списке приглашённых. Напиши владельцу, чтобы он добавил твою почту.'

/**
 * Общая формулировка для случая, когда GoTrue замаскировал ошибку триггера.
 * Раньше здесь стоял текст про закрытый тест: пока белый список был активен,
 * это почти всегда была именно «нет в списке». После открытия регистрации
 * (docs/open-registration.sql) та же маска будет означать настоящий сбой —
 * и говорить человеку «тебя не приглашали» стало бы неправдой.
 */
const GENERIC_SIGNUP_TEXT =
  'Не получилось создать профиль. Попробуй ещё раз через минуту — если снова не выйдет, напиши нам.'

/**
 * Превращает техническую ошибку регистрации в понятную пользователю.
 * Всё, что не опознано, возвращаем как есть — иначе настоящие проблемы
 * (слабый пароль, занятый email) будут маскироваться.
 */
export function describeSignUpError(raw: string): string {
  const s = raw.toLowerCase()
  if (raw.includes(NOT_INVITED_MARKER)) return NOT_INVITED_TEXT
  if (s.includes('database error saving new user') || s.includes('unexpected_failure')) {
    return GENERIC_SIGNUP_TEXT
  }
  return describeAuthError(raw)
}

/**
 * Ошибки входа и регистрации от GoTrue приходят ПО-АНГЛИЙСКИ, а мы обещаем
 * человеку русский интерфейс: «Invalid login credentials» на экране входа —
 * это первое, что видит новый пользователь, если промахнулся по клавише.
 * Переводим известные случаи; неизвестное отдаём как есть, но с припиской,
 * чтобы человек хотя бы понял, что делать дальше.
 */
export function describeAuthError(raw: string): string {
  const s = raw.toLowerCase()
  if (s.includes('invalid login credentials'))
    return 'Неверная почта или пароль. Проверь раскладку и заглавные буквы.'
  if (s.includes('email not confirmed'))
    return 'Почта ещё не подтверждена — открой письмо от нас и нажми ссылку. Письма нет? Загляни в «Спам».'
  if (s.includes('password should be at least'))
    return 'Пароль слишком короткий — нужно минимум 8 символов.'
  if (s.includes('user already registered') || s.includes('already been registered'))
    return 'Такая почта уже зарегистрирована. Войди с ней или восстанови пароль.'
  if (s.includes('unable to validate email') || s.includes('invalid format'))
    return 'Почта написана с ошибкой — проверь адрес.'
  if (s.includes('rate limit') || s.includes('you can only request this after'))
    return 'Слишком много попыток подряд. Подожди минуту и попробуй снова.'
  if (s.includes('signups not allowed'))
    return 'Регистрация сейчас закрыта. Напиши нам — откроем доступ.'
  if (s.includes('failed to fetch') || s.includes('networkerror') || s.includes('load failed'))
    return 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.'
  return `Не получилось: ${raw}. Попробуй ещё раз — если повторится, напиши нам.`
}

/**
 * Заблокирован ли текущий пользователь.
 *
 * Намеренно fail-open: при сетевой ошибке возвращаем false. Запереть человека
 * из-за отвалившегося интернета хуже, чем на минуту пустить заблокированного —
 * тем более что настоящая блокировка (Ban user в Supabase) не зависит от этого
 * флага и работает на уровне выдачи токенов.
 */
export async function isBlocked(): Promise<boolean> {
  // getSession() читает локально, в отличие от getUser(), который ходит в сеть
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const uid = session?.user.id
  if (!uid) return false

  const { data, error } = await supabase
    .from('profiles')
    .select('blocked')
    .eq('id', uid)
    .maybeSingle()

  if (error) return false
  return data?.blocked === true
}
