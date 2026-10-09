// Описание: src/features/auth/CLAUDE.md
import { supabase } from '../shared/api/supabase'
import { SUPPORT_EMAIL } from '../shared/lib/contacts'

/**
 * Контроль доступа: белый список приглашённых + флаг блокировки.
 * Оба механизма живут в БД (supabase/migrations, блок «КОНТРОЛЬ ДОСТУПА»),
 * здесь только чтение состояния и человеческие формулировки ошибок.
 * Подробности и команды управления — docs/ACCESS-CONTROL.md
 *
 * Тексты — для входа и регистрации, а это открытые страницы: на «вы»
 * (журнал п.71). Контакт — почтой: блока связи у формы входа нет.
 */

/**
 * Маркер, которым триггер handle_new_user отклоняет незваный email.
 * Supabase Auth не всегда пробрасывает текст исключения из триггера наружу —
 * при ошибке в БД GoTrue отдаёт обобщённое «Database error saving new user».
 * Поэтому ловим и маркер, и обобщённую формулировку.
 */
const NOT_INVITED_MARKER = 'RECALL_NOT_INVITED'

const NOT_INVITED_TEXT =
  `Этот адрес не в списке приглашённых. Напишите на ${SUPPORT_EMAIL}, чтобы его добавили.`

/**
 * Общая формулировка для случая, когда GoTrue замаскировал ошибку триггера.
 * Раньше здесь стоял текст про закрытый тест: пока белый список был активен,
 * это почти всегда была именно «нет в списке». После открытия регистрации
 * (docs/open-registration.sql) та же маска будет означать настоящий сбой —
 * и говорить человеку «вас не приглашали» стало бы неправдой.
 */
const GENERIC_SIGNUP_TEXT =
  `Не получилось создать профиль. Попробуйте ещё раз через минуту — если снова не выйдет, напишите на ${SUPPORT_EMAIL}.`

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
    return 'Неверная почта или пароль. Проверьте раскладку и заглавные буквы, а если пароль забылся — нажмите «Забыли пароль?».'
  if (s.includes('email not confirmed'))
    return 'Почта ещё не подтверждена — откройте письмо от нас и нажмите ссылку. Письма нет? Загляните в «Спам».'
  if (s.includes('password should be at least'))
    return 'Пароль слишком короткий — нужно минимум 8 символов.'
  // ⚠️ Существование аккаунта НЕ раскрываем: перебирая адреса, посторонний
  // собрал бы список тех, кто у нас учится. Сам Supabase эту ошибку на
  // регистрацию занятого адреса больше не отдаёт (проверено на проекте:
  // приходит успех с пустым identities, и мы показываем экран «проверьте почту»
  // — ровно то, что нужно). Ветка остаётся страховкой на случай старого
  // поведения и отвечает нейтрально.
  if (s.includes('user already registered') || s.includes('already been registered'))
    return 'Если такой адрес у нас есть, письмо уже в пути. Пароль не помните — нажмите «Забыли пароль?» на входе.'
  if (s.includes('unable to validate email') || s.includes('invalid format'))
    return 'Почта написана с ошибкой — проверьте адрес.'
  if (s.includes('rate limit') || s.includes('you can only request this after'))
    return 'Слишком много попыток подряд. Подождите минуту и попробуйте снова.'
  if (s.includes('signups not allowed'))
    return `Регистрация сейчас закрыта. Напишите на ${SUPPORT_EMAIL} — откроем доступ.`
  if (s.includes('failed to fetch') || s.includes('networkerror') || s.includes('load failed'))
    return 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.'
  return `Не получилось: ${raw}. Попробуйте ещё раз — если повторится, напишите на ${SUPPORT_EMAIL}.`
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
