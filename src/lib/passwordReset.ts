// ============================================================================
// Пароль: восстановление по письму и смена изнутри приложения.
//
// Всё правило живёт ЗДЕСЬ. Экранов три (запрос письма, новый пароль, блок в
// «Настройках»), и если каждый будет решать сам, они разойдутся молча: один
// начнёт обрывать чужие сессии, другой нет — а по внешнему виду это не отличить.
//
// ⚠️ ГЛАВНОЕ РЕШЕНИЕ: токен проверяется в момент отправки нового пароля, а НЕ
// при открытии страницы. Ссылка из письма одноразовая, и её открывают за
// человека: корпоративные антивирусы, превью в мессенджерах, предзагрузка в
// почтовом клиенте. Если проверять на входе, такой «посетитель» сжигает токен —
// человек доходит по ссылке и видит «ссылка недействительна», не сделав ничего.
//
// ⚠️ ВТОРОЕ: после смены пароля обрываем ВСЕ остальные сессии. Пароль чаще
// всего меняют потому, что в аккаунт кто-то зашёл; refresh-токен чужого
// устройства живёт и продлевается сам — без этого шага сброс бессмысленный.
// ============================================================================
import { supabase } from './supabase'

/** Минимальная длина пароля. Совпадает с minLength в формах входа. */
export const MIN_PASSWORD = 8

/**
 * Один и тот же ответ для существующего и несуществующего адреса.
 * Проверено на живом проекте: сам Supabase их тоже не различает — ошибки нет
 * в обоих случаях. Значит достаточно не выдумывать разницу на экране.
 */
export const RESET_SENT_TEXT = 'Если такой адрес у нас есть, письмо уже в пути.'

/** Куда ведёт ссылка из письма. Тот же адрес нужен в Supabase → Redirect URLs. */
export function resetRedirectUrl(): string {
  return `${window.location.origin}/reset-password`
}

// ---------------------------------------------------------------------------
// Токен из ссылки живёт в sessionStorage, а не в памяти компонента.
//
// Из адреса его надо убрать сразу (история браузера, заголовок Referer), но
// тогда единственная копия оказывается в переменной — и любая перезагрузка
// страницы стирает её. Человек с рабочей ссылкой видит форму «введите код»,
// которого у него нет: ссылку он уже открыл, а письмо не читал. Обновить
// страницу успевают и сами (палец на F5), и приложение (обновление PWA).
//
// sessionStorage переживает перезагрузку и умирает вместе с вкладкой. Это не
// «менее безопасно, чем переменная»: доступ к нему требует того же самого
// выполнения чужого кода на нашей странице, при котором уже потеряна и сессия.
// ---------------------------------------------------------------------------
const TOKEN_KEY = 'recall.recovery.token'

export function rememberRecoveryToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* приватный режим — обойдёмся памятью вызывающего */
  }
}

export function recoveryToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function forgetRecoveryToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* нечего забывать */
  }
}

/** В коде из письма только цифры; пробелы и дефисы при вставке — обычное дело. */
export function cleanCode(raw: string): string {
  return raw.replace(/\D+/g, '')
}

/**
 * Похоже ли на код из письма. Длину не фиксируем жёстко: у нашего проекта
 * Supabase выдаёт ВОСЕМЬ цифр (проверено через generateLink), но настройка
 * длины живёт на стороне сервера и может смениться без единой правки в коде.
 */
export function isCodeLike(code: string): boolean {
  const digits = cleanCode(code)
  return digits.length >= 6 && digits.length <= 10
}

/** Проверка нового пароля. Возвращает текст ошибки или null. */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Пароль короче ${MIN_PASSWORD} символов.`
  if (password.trim().length === 0) return 'Пароль не может быть из одних пробелов.'
  return null
}

/**
 * Ошибки восстановления приходят от Supabase по-английски. Человек в этот
 * момент и так раздражён — он не смог войти; английская техническая строка
 * добивает. Неизвестное отдаём как есть, но с подсказкой, что делать.
 */
export function describeResetError(raw: string): string {
  const s = raw.toLowerCase()
  if (s.includes('token has expired') || s.includes('otp_expired') || s.includes('expired'))
    return 'Ссылка или код уже недействительны — они живут 30 минут. Запроси письмо заново.'
  if (s.includes('invalid') && (s.includes('token') || s.includes('otp')))
    return 'Код не подошёл. Проверь, что взял его из последнего письма — старые перестают работать.'
  if (s.includes('same as the old') || s.includes('should be different'))
    return 'Это твой прежний пароль. Придумай другой.'
  if (s.includes('password should be at least') || s.includes('weak'))
    return `Пароль слишком короткий — нужно минимум ${MIN_PASSWORD} символов.`
  if (s.includes('rate limit') || s.includes('you can only request this after') || s.includes('too many'))
    return 'Слишком много попыток подряд. Подожди минуту и попробуй снова.'
  if (s.includes('failed to fetch') || s.includes('networkerror') || s.includes('load failed'))
    return 'Нет связи с сервером. Проверь интернет и попробуй ещё раз.'
  return `Не получилось: ${raw}. Попробуй ещё раз — если повторится, напиши нам.`
}

/**
 * Запрос письма. Ошибку наружу отдаём только техническую (сеть, лимит частоты):
 * «такого адреса нет» здесь не бывает и быть не должно.
 */
export async function requestReset(email: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: resetRedirectUrl(),
  })
  return error ? { error: describeResetError(error.message) } : {}
}

/**
 * Проверка кода из письма ОТДЕЛЬНЫМ шагом: пока код не принят, поле нового
 * пароля не показывается.
 *
 * Так человек узнаёт про опечатку сразу, а не после того, как придумал пароль:
 * при одной общей форме отказ приходил уже с набранным паролем, и было
 * непонятно, что именно не подошло — код или пароль.
 *
 * ⚠️ Для ссылки такой шаг НЕВОЗМОЖЕН: её открывают за человека почтовые
 * сканеры, и ранняя проверка сожгла бы одноразовый токен. Там проверка
 * по-прежнему откладывается до отправки формы — см. completeReset.
 */
export async function verifyRecoveryCode(
  email: string,
  code: string,
): Promise<{ error?: string }> {
  const { error } = await supabase.auth.verifyOtp({
    type: 'recovery',
    email: email.trim(),
    token: cleanCode(code),
  })
  return error ? { error: describeResetError(error.message) } : {}
}

export interface CompleteResetResult {
  error?: string
  /** Токен уже потрачен: повторно проверять его нельзя, он одноразовый. */
  verified: boolean
}

/**
 * Второй шаг: подтверждаем владение почтой и ставим новый пароль.
 *
 * `verified` в ответе — не украшение. Если токен приняли, а пароль не подошёл
 * (короткий, совпал со старым), человек остаётся в сессии, а токен уже сгорел.
 * Экран обязан помнить это и на второй попытке звать нас БЕЗ токена — иначе
 * получит «код недействителен» на ровном месте и решит, что письмо испорчено.
 */
export async function completeReset(params: {
  password: string
  /** Ссылка из письма. */
  tokenHash?: string
  /** Код из письма (нужен вместе с адресом). */
  code?: string
  email?: string
  /** Токен уже принят на прошлой попытке — проверять нечего. */
  alreadyVerified?: boolean
}): Promise<CompleteResetResult> {
  const { password, tokenHash, code, email, alreadyVerified } = params
  const bad = validatePassword(password)
  if (bad) return { error: bad, verified: !!alreadyVerified }

  let verified = !!alreadyVerified
  if (!verified) {
    if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
      if (error) return { error: describeResetError(error.message), verified: false }
    } else if (code && email) {
      const { error } = await supabase.auth.verifyOtp({
        type: 'recovery',
        email: email.trim(),
        token: cleanCode(code),
      })
      if (error) return { error: describeResetError(error.message), verified: false }
    } else {
      return { error: 'Нужна ссылка из письма или код.', verified: false }
    }
    verified = true
  }

  const { error: upErr } = await supabase.auth.updateUser({ password })
  if (upErr) return { error: describeResetError(upErr.message), verified }

  forgetRecoveryToken()
  await dropOtherSessions()
  return { verified }
}

/**
 * Смена пароля изнутри приложения. Текущий пароль спрашиваем по-настоящему:
 * Supabase его НЕ требует, поэтому без этой проверки любой, кто на минуту сел
 * за чужой незаблокированный компьютер, меняет пароль и забирает аккаунт.
 */
export async function changePassword(
  email: string,
  current: string,
  next: string,
): Promise<{ error?: string }> {
  const bad = validatePassword(next)
  if (bad) return { error: bad }
  if (current === next) return { error: 'Новый пароль совпадает с текущим.' }

  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: current,
  })
  if (signInErr) {
    return /invalid login credentials/i.test(signInErr.message)
      ? { error: 'Текущий пароль неверный.' }
      : { error: describeResetError(signInErr.message) }
  }

  const { error } = await supabase.auth.updateUser({ password: next })
  if (error) return { error: describeResetError(error.message) }

  await dropOtherSessions()
  return {}
}

/**
 * Обрывает входы на всех остальных устройствах, оставляя текущее.
 * Сбой глушим намеренно: пароль уже сменён, и показывать из-за этого ошибку —
 * значит убедить человека, что смена не удалась, и заставить менять снова.
 */
async function dropOtherSessions(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'others' })
  } catch {
    /* пароль сменён — это главное */
  }
}
