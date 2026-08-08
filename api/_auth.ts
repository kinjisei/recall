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
import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// CORS: только известные origin'ы (реальный фронт ходит same-origin).
export const ALLOWED_ORIGINS = ['https://recall-pgkz.vercel.app', 'http://localhost:5173']

export type AuthResult =
  /** refundToken — серверная метка списания: по ней и только по ней его можно
   *  вернуть, если ответа от AI так и не случилось (см. refundAiCall). */
  | { ok: true; refundToken?: string }
  | { ok: false; status: number; error: string }

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

/** Пускает только вошедших, не заблокированных и не исчерпавших лимит.
 * cost — цена действия в ЭНЕРГИИ (heavy), generation — материал/программа
 * (месячный лимит вместо энергии). Списывает через spend_energy; если функции
 * ещё нет в БД (миграция E1 не залита) — откат на consume_ai_quota. */
export async function authorize(
  req: VercelRequest,
  kind: QuotaKind = 'heavy',
  cost?: number,
  generation = false,
): Promise<AuthResult> {
  const auth = req.headers.authorization
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!token || !url || !anon) return DENIED
  // энергия действия: heavy по умолчанию 1 ⚡, light/speech — 0 (только анти-абьюз)
  const p_cost = cost ?? (kind === 'heavy' ? 1 : 0)

  try {
    const rpc = (fn: string, body: string) =>
      fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anon,
          'Content-Type': 'application/json',
        },
        body,
      })

    // Основной путь — энергия (E1). Фолбэки на старую RPC держат деплой безопасным
    // и до, и после миграции (клиент/сервер не ломаются в переходный момент).
    // Токен возврата рождается ЗДЕСЬ, на сервере, и клиенту не уходит. Иначе
    // возврат стал бы отмычкой: RPC доступна пользователю с его же токеном, и
    // «верни последнее списание» означало бы безлимитный AI в один вызов.
    const nonce = randomUUID()
    let refundable = true
    let r = await rpc(
      'spend_energy',
      JSON.stringify({ p_kind: kind, p_cost, p_generation: generation, p_nonce: nonce }),
    )
    if (r.status === 404) {
      // База ещё без параметра p_nonce (миграция этапа 2 не залита) — пробуем
      // прежнюю сигнатуру. Возврат в этом случае невозможен, и это честнее,
      // чем притворяться: сервер просто не станет его звать.
      refundable = false
      r = await rpc('spend_energy', JSON.stringify({ p_kind: kind, p_cost, p_generation: generation }))
    }
    if (r.status === 404) {
      // spend_energy ещё нет — старый путь по классам (блок «КЛАССЫ КВОТ»)…
      r = await rpc('consume_ai_quota', JSON.stringify({ p_kind: kind }))
      // …а если и её нет (совсем старая база) — по-старому без класса
      if (r.status === 404) r = await rpc('consume_ai_quota', '{}')
    }
    if (r.ok) return { ok: true, refundToken: refundable ? nonce : undefined }
    if (r.status === 401 || r.status === 403) return DENIED

    const body = await r.text()
    if (body.includes('RECALL_NO_AUTH')) return DENIED
    if (body.includes('RECALL_ENERGY_POOL')) {
      return {
        ok: false,
        status: 429,
        error:
          'Энергия студии на сегодня закончилась. Она вернётся утром — ' +
          'чтение, слова, грамматика и произношение работают как обычно.',
      }
    }
    if (body.includes('RECALL_ENERGY_SUBCAP')) {
      return {
        ok: false,
        status: 429,
        error:
          'На сегодня по твоему аккаунту хватит AI — чтобы хватило всей студии. ' +
          'Энергия вернётся утром; слова, тексты и игры работают без ограничений.',
      }
    }
    if (body.includes('RECALL_ENERGY_DAY')) {
      return {
        ok: false,
        status: 429,
        error:
          'Дневная энергия закончилась — вернётся утром. Слова, тексты и игры ' +
          'работают без лимитов; больше AI даёт тариф побольше.',
      }
    }
    if (body.includes('RECALL_GEN_LIMIT')) {
      return {
        ok: false,
        status: 429,
        // Раньше репетитор на триале читал это на ПЕРВОЙ же попытке, хотя
        // лимита у него не было вовсе (0 генераций). Теперь пробных две —
        // ровно один материал целиком, — и сообщение стало правдой.
        error:
          'Генерации материалов и программ на этот месяц закончились. ' +
          'На пробном периоде их две — на один материал целиком; ' +
          'дальше их даёт оплаченный тариф репетитора.',
      }
    }
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

    // Развилка (заход 3 аудита): «функции нет» vs «функция упала».
    //
    // (а) Функция ОТСУТСТВУЕТ (404 / PGRST202) — миграция ещё не применена:
    //     деплой кода мог опередить заливку схемы. Только тут fail-OPEN —
    //     пропускаем по валидности токена, чтобы новый деплой не ронял AI до
    //     заливки. Ситуация краткая и ожидаемая.
    if (r.status === 404 || body.includes('PGRST202')) {
      console.error('consume_ai_quota НЕ НАЙДЕНА (миграция не залита?) — лимиты временно не действуют:', body.slice(0, 200))
      return (await tokenValid(url, anon, token)) ? { ok: true } : DENIED
    }

    // (б) Функция ЕСТЬ, но упала с неизвестной ошибкой — это БАГ в SQL квот
    //     (как ambiguous-переменная 24.07, из-за которой лимиты ТИХО отключились
    //     на неделю). fail-CLOSED: не открываем доступ молча, а отказываем —
    //     сбой видно сразу по жалобам, а не потом по счёту за токены.
    console.error('consume_ai_quota упала с неожиданной ошибкой — AI закрыт (fail-closed):', body.slice(0, 300))
    return {
      ok: false,
      status: 503,
      error: 'Сервис AI временно недоступен. Попробуй через минуту.',
    }
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

/**
 * Возврат списания, если ответа от AI так и не было.
 *
 * Зовётся ТОЛЬКО сервером и только с токеном, который сам же и выдал в
 * authorize. Пользователь этого токена не видит, поэтому вернуть чужое или
 * своё «по желанию» не может. Ошибки глушим: не смогли вернуть — человек
 * потерял одну единицу энергии, это неприятно, но безопасно; уронить ответ
 * из-за неудачного возврата было бы хуже.
 */
export async function refundAiCall(req: VercelRequest, token?: string): Promise<void> {
  if (!token) return
  const auth = req.headers.authorization
  const jwt = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if (!jwt || !url || !anon) return
  try {
    await fetch(`${url}/rest/v1/rpc/refund_ai_call`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: anon,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_nonce: token }),
    })
  } catch {
    /* возврат — «лучшее усилие», молча */
  }
}
