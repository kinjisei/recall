// ============================================================================
// Общая авторизация и CORS для серверных функций (api/gemini, api/transcribe).
// Файл с «_» — Vercel НЕ делает из него отдельную функцию.
//
// Одна RPC spend_energy (supabase/migrations), вызванная с JWT пользователя,
// за один запрос покрывает: валидность токена, бан, флаг blocked, энергию,
// месячный лимит генераций и анти-абьюз-кэп своего класса (heavy / light /
// speech). Счётчик живёт в БД и клиенту недоступен. Любой AI-эндпоинт обязан
// пройти через authorize(), иначе открытый прокси позволит жечь квоту.
// ============================================================================
import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { TIMEOUTS, timedFetch } from './_timeouts.js'

// CORS: только известные origin'ы (реальный фронт ходит same-origin).
export const ALLOWED_ORIGINS = ['https://recall-pgkz.vercel.app', 'http://localhost:5173']

export type AuthResult =
  /** refundToken — серверный номер списания: по нему и только по нему его
   *  можно вернуть (refundAiCall) и записать итог вызова (api/_usage.ts). */
  | { ok: true; refundToken: string }
  | { ok: false; status: number; error: string }

/** Отказ авторизации — та ветка AuthResult, где есть код ответа и текст. */
export type AuthDenied = Extract<AuthResult, { ok: false }>

/**
 * Проверка «не пустили» ЯВНЫМ предикатом, а не через `if (!access.ok)`.
 *
 * ⚠️ Так надо, и вот почему. Наш `npm run build` проверяет `api/` по
 * tsconfig.node.json со `strict: true`, а Vercel собирает функции по КОРНЕВОМУ
 * tsconfig.json — а он у нас файл-решение, из одних `references`, без
 * compilerOptions. Значит на Vercel действует `strictNullChecks: false`, и в
 * этом режиме TypeScript НЕ сужает размеченное объединение по `!access.ok`:
 * сборка падает с «Property 'status' does not exist on type AuthResult», хотя
 * локально всё зелено. Предикат сужает при любых флагах.
 */
export function authDenied(result: AuthResult): result is AuthDenied {
  return !result.ok
}

/**
 * Класс запроса — от него зависит, из какого «кармана» списывается лимит:
 *   heavy  — Диалог, письмо, квесты, разбор работ, материалы (тратят энергию
 *            или месячный лимит генераций);
 *   light  — перевод слова, определения (0 ⚡, только анти-абьюз-кэп);
 *   speech — распознавание речи в тренажёре произношения (0 ⚡, свой кэп).
 * Раньше всё считалось одним счётчиком, и десяток тапов по словам съедал
 * дневной лимит целиком.
 */
export type QuotaKind = 'heavy' | 'light' | 'speech'

const DENIED: AuthDenied = { ok: false, status: 401, error: 'Требуется вход в приложение' }

/**
 * Supabase не ответил вовремя или связь оборвалась. Это НЕ «нужен вход» и не
 * «ты не преподаватель»: доступ закрыт, но говорим правду — иначе человек
 * полезет перелогиниваться или решит, что у него отняли роль.
 */
export const UNAVAILABLE: AuthDenied = {
  ok: false,
  status: 503,
  error: 'Сервис AI временно недоступен. Попробуй через минуту.',
}

/**
 * Чем войти в базу от имени пользователя: его токен, адрес проекта и
 * публичный ключ sb_publishable_ — тот же, что в бандле (Ф1.9). Новый ключ
 * идёт только в заголовок apikey, в Authorization — токен пользователя.
 */
interface Credentials {
  url: string
  apikey: string
  jwt: string
}

function credentials(req: VercelRequest): Credentials | null {
  const auth = req.headers.authorization
  const jwt = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  const url = process.env.VITE_SUPABASE_URL
  const apikey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  return jwt && url && apikey ? { url, apikey, jwt } : null
}

export interface RpcReply {
  ok: boolean
  status: number
  text: string
}

/** RPC под токеном пользователя. Тело читаем внутри окна: зависнуть можно и на середине. */
function rpcAs(c: Credentials, fn: string, args: object, ms: number): Promise<RpcReply> {
  return timedFetch(
    `${c.url}/rest/v1/rpc/${fn}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.jwt}`, apikey: c.apikey, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    },
    ms,
    async (r) => ({ ok: r.ok, status: r.status, text: await r.text() }),
  )
}

/**
 * RPC от имени того, кто прислал запрос. null — войти нечем (нет токена или
 * адреса базы). Бросает по сроку и при сбое связи.
 */
export function userRpc(
  req: VercelRequest,
  fn: string,
  args: object,
  ms = TIMEOUTS.supabaseMs,
): Promise<RpcReply> | null {
  const c = credentials(req)
  return c ? rpcAs(c, fn, args, ms) : null
}

/**
 * Преподаватель ли вызывающий (profiles.role = 'teacher').
 *
 * Нужна для задач, которые вправе запускать только учитель (material,
 * program, homework). Зовётся ТОЛЬКО для них — их единицы в день, поэтому два
 * лишних запроса не влияют на горячий путь (Диалог, перевод слова).
 *
 * ⚠️ Id пользователя берём у Supabase (/auth/v1/user), а НЕ из полезной
 * нагрузки JWT: подпись мы не проверяем, а RLS на profiles разрешает читать не
 * только свою строку (ученица видит профиль своего преподавателя). Возьми мы
 * id из токена «на веру» — ученица подставила бы id учителя и прочитала бы его
 * role='teacher', то есть проверка бы её же и пропустила.
 * Закрыто по умолчанию: при любой ошибке — не пускаем. Но «Supabase не
 * ответил» (null) отличаем от «не преподаватель» (false), чтобы не сказать
 * учителю неправду про его роль.
 */
export async function isTeacher(
  req: VercelRequest,
  ms = TIMEOUTS.supabaseMs,
): Promise<boolean | null> {
  const c = credentials(req)
  if (!c) return false

  const headers = { Authorization: `Bearer ${c.jwt}`, apikey: c.apikey }
  const readJson = async (r: Response) => (r.ok ? ((await r.json()) as unknown) : null)
  try {
    const me = (await timedFetch(`${c.url}/auth/v1/user`, { headers }, ms, readJson)) as {
      id?: string
    } | null
    if (!me?.id) return false

    const rows = (await timedFetch(
      `${c.url}/rest/v1/profiles?id=eq.${encodeURIComponent(me.id)}&select=role`,
      { headers },
      ms,
      readJson,
    )) as { role?: string }[] | null
    return rows?.[0]?.role === 'teacher'
  } catch {
    return null // не ответил вовремя или оборвалась связь
  }
}

/**
 * Отказы spend_energy → текст человеку. Про энергию — в ⚡, на том же языке,
 * что счётчик на экране (CLAUDE.md, раздел «Энергия»).
 */
const REFUSALS: [code: string, status: number, error: string][] = [
  [
    'RECALL_ENERGY_POOL',
    429,
    'Энергия студии на сегодня закончилась. Она вернётся утром — ' +
      'чтение, слова, грамматика и произношение работают как обычно.',
  ],
  [
    'RECALL_ENERGY_SUBCAP',
    429,
    'На сегодня по твоему аккаунту хватит AI — чтобы хватило всей студии. ' +
      'Энергия вернётся утром; слова, тексты и игры работают без ограничений.',
  ],
  [
    'RECALL_ENERGY_DAY',
    429,
    'Дневная энергия закончилась — вернётся утром. Слова, тексты и игры ' +
      'работают без лимитов; больше AI даёт тариф побольше.',
  ],
  // Ролево-нейтрально: лимит генераций есть и у самоучки (материалы под себя),
  // и у репетитора (материалы и программы ученикам).
  [
    'RECALL_GEN_LIMIT',
    429,
    'Генерации на этот месяц закончились. Материалы под себя даёт ' +
      'Premium; материалы и программы для учеников — тариф репетитора. ' +
      'На пробном периоде доступен один материал.',
  ],
  ['RECALL_BLOCKED', 403, 'Доступ к аккаунту приостановлен'],
  [
    'RECALL_LIGHT_LIMIT',
    429,
    'Слишком много переводов слов за сутки. Лимит обновится завтра — ' +
      'чтение, игры и повторение слов работают как обычно.',
  ],
  [
    'RECALL_SPEECH_LIMIT',
    429,
    'Дневной лимит проверок произношения исчерпан. Он обновится завтра — ' +
      'слушать эталон и повторять вслух можно без ограничений.',
  ],
  [
    'RECALL_FREE_LIMIT',
    429,
    'Энергия на сегодня закончилась — на бесплатном тарифе это 5 ⚡ в день. ' +
      'Вернётся утром. Слова, тексты и игры работают без лимитов; ' +
      'больше AI даёт Premium — раздел «Тарифы» в настройках.',
  ],
  ['RECALL_RATE_HOUR', 429, 'Слишком много запросов к ИИ подряд. Попробуй через несколько минут.'],
]

/** Пускает только вошедших, не заблокированных и не исчерпавших лимит.
 * cost — цена действия в ЭНЕРГИИ (heavy), generation — материал/программа
 * (месячный лимит вместо энергии). Списывает через spend_energy. */
export async function authorize(
  req: VercelRequest,
  kind: QuotaKind = 'heavy',
  cost?: number,
  generation = false,
  /** Окно одного запроса в Supabase, мс (api/_timeouts.ts). */
  supabaseMs = TIMEOUTS.supabaseMs,
): Promise<AuthResult> {
  const c = credentials(req)
  if (!c) return DENIED
  // энергия действия: heavy по умолчанию 1 ⚡, light/speech — 0 (только анти-абьюз)
  const p_cost = cost ?? (kind === 'heavy' ? 1 : 0)
  // Номер списания рождается ЗДЕСЬ, на сервере, и клиенту не уходит. Иначе
  // возврат стал бы отмычкой: RPC доступна пользователю с его же токеном, и
  // «верни последнее списание» означало бы безлимитный AI в один вызов.
  const nonce = randomUUID()

  let r: RpcReply
  try {
    r = await rpcAs(c, 'spend_energy', { p_kind: kind, p_cost, p_generation: generation, p_nonce: nonce }, supabaseMs)
  } catch {
    // Supabase не ответил вовремя или оборвалась связь. Списание могло пройти
    // на той стороне, а ответ до нас не дойти — тогда человек заплатил бы за
    // отказ. Возвращаем по тому же номеру: незнакомый номер refund_ai_call
    // просто пропускает. Если списание ещё идёт, общий замок пользователя
    // (pg_advisory_xact_lock в обеих функциях) заставит возврат его дождаться.
    // Остаток: запрос списания ещё не дошёл до базы — возврат ничего не найдёт,
    // и единица пропадёт. Это редкость в редкости, и лучше, чем без возврата.
    console.warn('Supabase не ответил на списание — AI закрыт, возврат по номеру')
    await rpcAs(c, 'refund_ai_call', { p_nonce: nonce }, supabaseMs).catch(() => {})
    return UNAVAILABLE
  }
  if (r.ok) return { ok: true, refundToken: nonce }
  if (r.status === 401 || r.status === 403 || r.text.includes('RECALL_NO_AUTH')) return DENIED

  const refusal = REFUSALS.find(([code]) => r.text.includes(code))
  if (refusal) return { ok: false, status: refusal[1], error: refusal[2] }

  // Функции нет (404) или она упала с неизвестной ошибкой — AI ЗАКРЫТ.
  // Раньше отсутствие функции пропускало по одной валидности токена, «пока
  // миграция не залита». С порядком «миграция, потом код» (журнал п.47) этот
  // случай — только поломка, а пропуск в нём означал бы AI без лимитов. Сбой
  // видно сразу по жалобам, а не потом по счёту за токены (ambiguous-
  // переменная 24.07 так ТИХО отключила лимиты на неделю).
  console.error(`spend_energy ответила ${r.status} — AI закрыт:`, r.text.slice(0, 300))
  return UNAVAILABLE
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

/**
 * Возврат списания, если ответа от AI так и не было.
 *
 * Зовётся ТОЛЬКО сервером и только с номером, который сам же и выдал в
 * authorize. Пользователь этого номера не видит, поэтому вернуть чужое или
 * своё «по желанию» не может. Ошибки глушим: не смогли вернуть — человек
 * потерял одну единицу энергии, это неприятно, но безопасно; уронить ответ
 * из-за неудачного возврата было бы хуже.
 * Обычно возврат идёт вместе с записью итога (api/_usage.ts); отдельно — когда
 * журнал недоступен.
 */
export async function refundAiCall(
  req: VercelRequest,
  token: string,
  /** Окно запроса, мс: возврат обязан успеть до обрыва функции. */
  ms = TIMEOUTS.supabaseMs,
): Promise<void> {
  await userRpc(req, 'refund_ai_call', { p_nonce: token }, ms)?.catch(() => {})
}
