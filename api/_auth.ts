// ============================================================================
// Общая авторизация и CORS для серверных функций (api/gemini, api/transcribe).
// Файл с «_» — Vercel НЕ делает из него отдельную функцию.
//
// Одна RPC consume_ai_quota(kind) (docs/schema.sql, блоки «ЛИМИТЫ НА AI» и
// «КЛАССЫ КВОТ»), вызванная с JWT пользователя, за один запрос покрывает:
// валидность токена, бан, флаг blocked и суточный лимит СВОЕГО класса
// (heavy / light / speech). Счётчик живёт в БД и клиенту недоступен.
// Любой AI-эндпоинт обязан пройти через authorize(), иначе открытый прокси
// позволит жечь бесплатную квоту.
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node'

// CORS: только известные origin'ы (реальный фронт ходит same-origin).
export const ALLOWED_ORIGINS = ['https://recall-pgkz.vercel.app', 'http://localhost:5173']

export type AuthResult = { ok: true } | { ok: false; status: number; error: string }

/**
 * Класс запроса — от него зависит, из какого «кармана» списывается лимит:
 *   heavy  — Диалог, письмо, квесты, разбор работ, материалы (это и есть
 *            «AI-действие» из тарифов: дорогие умные модели);
 *   light  — перевод слова, определения, пакетное добавление слов (дешёвые
 *            модели с огромной бесплатной квотой);
 *   speech — распознавание речи в тренажёре произношения.
 * Раньше всё считалось одним счётчиком, и десяток тапов по словам съедал
 * дневной лимит целиком (см. блок «КЛАССЫ КВОТ» в docs/schema.sql).
 */
export type QuotaKind = 'heavy' | 'light' | 'speech'

const DENIED: AuthResult = { ok: false, status: 401, error: 'Требуется вход в приложение' }

/** Резервная проверка токена — на случай, если RPC ещё не создана в БД. */
async function tokenValid(url: string, anon: string, token: string): Promise<boolean> {
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anon },
  })
  return r.ok
}

/**
 * Преподаватель ли вызывающий (profiles.role = 'teacher').
 *
 * Нужна для задач на Pro-моделях (material/program): их вправе запускать
 * только учитель. Зовётся ТОЛЬКО для этих задач — их единицы в день, поэтому
 * два лишних запроса не влияют на горячий путь (Диалог, перевод слова).
 *
 * ⚠️ Id пользователя берём у Supabase (/auth/v1/user), а НЕ из полезной
 * нагрузки JWT: подпись мы не проверяем, а RLS на profiles разрешает читать не
 * только свою строку (ученица видит профиль своего преподавателя). Возьми мы
 * id из токена «на веру» — ученица подставила бы id учителя и прочитала бы его
 * role='teacher', то есть проверка бы её же и пропустила.
 * При любой ошибке отвечаем false — закрыто по умолчанию.
 */
export async function isTeacher(req: VercelRequest): Promise<boolean> {
  const auth = req.headers.authorization
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!token || !url || !anon) return false

  try {
    const headers = { Authorization: `Bearer ${token}`, apikey: anon }
    const me = await fetch(`${url}/auth/v1/user`, { headers })
    if (!me.ok) return false
    const { id } = (await me.json()) as { id?: string }
    if (!id) return false

    const r = await fetch(
      `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=role`,
      { headers },
    )
    if (!r.ok) return false
    const rows = (await r.json()) as { role?: string }[]
    return rows[0]?.role === 'teacher'
  } catch {
    return false
  }
}

/** Пускает только вошедших, не заблокированных и не исчерпавших лимит. */
export async function authorize(
  req: VercelRequest,
  kind: QuotaKind = 'heavy',
): Promise<AuthResult> {
  const auth = req.headers.authorization
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!token || !url || !anon) return DENIED

  try {
    const call = (body: string) =>
      fetch(`${url}/rest/v1/rpc/consume_ai_quota`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anon,
          'Content-Type': 'application/json',
        },
        body,
      })

    let r = await call(JSON.stringify({ p_kind: kind }))
    // Старая версия RPC (блок «КЛАССЫ КВОТ» ещё не выполнен в базе) не знает
    // параметра p_kind и отвечает PGRST202 — повторяем по-старому, без класса,
    // чтобы деплой кода до миграции не ломал AI.
    if (r.status === 404) r = await call('{}')
    if (r.ok) return { ok: true }
    if (r.status === 401 || r.status === 403) return DENIED

    const body = await r.text()
    if (body.includes('RECALL_NO_AUTH')) return DENIED
    if (body.includes('RECALL_BLOCKED')) {
      return { ok: false, status: 403, error: 'Доступ к аккаунту приостановлен' }
    }
    if (body.includes('RECALL_LIGHT_LIMIT')) {
      return {
        ok: false,
        status: 429,
        error:
          'Слишком много переводов слов за сутки. Лимит обновится завтра — ' +
          'чтение, игры и повторение слов работают как обычно.',
      }
    }
    if (body.includes('RECALL_SPEECH_LIMIT')) {
      return {
        ok: false,
        status: 429,
        error:
          'Дневной лимит проверок произношения исчерпан. Он обновится завтра — ' +
          'слушать эталон и повторять вслух можно без ограничений.',
      }
    }
    if (body.includes('RECALL_TRIAL_LIMIT')) {
      return {
        ok: false,
        status: 429,
        error:
          'Дневной AI-лимит пробного периода исчерпан (12 в день). ' +
          'Завтра он обновится, а после оплаты тарифа ограничение станет 200 в день. ' +
          'Слова, тексты и игры работают без лимитов.',
      }
    }
    if (body.includes('RECALL_FREE_LIMIT')) {
      return {
        ok: false,
        status: 429,
        error:
          'Дневной AI-лимит бесплатного тарифа исчерпан (5 в день). ' +
          'Подключи Premium — раздел «Тарифы» в настройках. Слова, тексты и игры работают без лимитов.',
      }
    }
    if (body.includes('RECALL_RATE_HOUR')) {
      return {
        ok: false,
        status: 429,
        error: 'Слишком много запросов к ИИ подряд. Попробуй через несколько минут.',
      }
    }
    if (body.includes('RECALL_RATE_DAY')) {
      return {
        ok: false,
        status: 429,
        error: 'Дневной лимит запросов к ИИ исчерпан. Он обновится завтра.',
      }
    }

    // Иная ошибка — либо «функция ещё не создана» (миграция не применена),
    // либо ошибка ВНУТРИ функции. Не роняем AI, но и вход не открываем:
    // проверяем токен обычным способом. ВАЖНО: в этом режиме лимиты не
    // работают вообще, поэтому кричим в лог — так сломанную RPC видно сразу,
    // а не через неделю по счёту за токены (реальный случай 24.07: из-за
    // ambiguous-переменной в SQL квоты молча перестали действовать).
    console.error('consume_ai_quota не отработала — ЛИМИТЫ AI ОТКЛЮЧЕНЫ:', body.slice(0, 300))
    return (await tokenValid(url, anon, token)) ? { ok: true } : DENIED
  } catch {
    return DENIED
  }
}

/** Проставляет CORS-заголовки; возвращает true, если это preflight (OPTIONS) и ответ уже закрыт. */
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
