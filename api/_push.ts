// ============================================================================
// Канал push (PLAN.md Ф2.9; архитектура §17): уведомление → телефон ученика.
//
// Подписки (куда слать и ключи шифрования) приходят в теле запроса от базы —
// своего доступа к базе у сервера нет. Шифрование (RFC 8291) и подпись VAPID
// (RFC 8292) — библиотека web-push, только её generateRequestDetails; сам
// запрос к службе push — наш timedFetch со сроком (голый fetch в api/
// запрещён, api/CLAUDE.md).
//
// Ответ службы:   201/200/202 — дошло; 404/410 — подписки больше нет (база её
// удалит, settle_dispatches); 429, 5xx, сбой связи, срок — временно, уведомление
// вернётся в очередь (до 3 попыток); прочие 4xx — наша ошибка, повтор не поможет.
//
// Ключи: VITE_VAPID_PUBLIC_KEY (тот же, что у клиента — одна строка на оба
// конца), VAPID_PRIVATE_KEY (только сервер), VAPID_SUBJECT (адрес сайта —
// почта владельца службам push не уходит). Ключей нет — канал молчит.
// ============================================================================
import webpush from 'web-push'
import { timedFetch } from './_timeouts.js'
import { pushView } from '../src/domains/notifications/model.js'
import type { Channel, DeliveryResult, OutgoingNotification, PushTarget } from './_channels.js'

export const PUSH_TIMEOUT_MS = 8000
const SITE = 'https://recall-pgkz.vercel.app'

export interface PushConfig {
  publicKey: string
  privateKey: string
  subject: string
}

export function pushConfig(env: NodeJS.ProcessEnv = process.env): PushConfig | null {
  const publicKey = env.VITE_VAPID_PUBLIC_KEY?.trim()
  const privateKey = env.VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject: env.VAPID_SUBJECT?.trim() || SITE }
}

/** Адрес службы push: https и доменное имя — как push_endpoint_ok в базе (0011). */
export function endpointOk(endpoint: string): boolean {
  try {
    const u = new URL(endpoint)
    return u.protocol === 'https:' && /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(u.hostname) &&
      !/(^localhost$|\.local$|\.internal$)/i.test(u.hostname) && endpoint.length <= 1000
  } catch {
    return false
  }
}

type Outcome = 'ok' | 'gone' | 'retry' | 'error'

export function classify(status: number): Outcome {
  if (status >= 200 && status < 300) return 'ok'
  if (status === 404 || status === 410) return 'gone'
  if (status === 429 || status >= 500) return 'retry'
  return 'error'
}

/** Отправка запроса службе push — параметром, чтобы тест подставил свою. */
export type PushSend = (url: string, init: { method: string; headers: Record<string, string>; body: Buffer }) => Promise<number>

const defaultSend: PushSend = (url, init) =>
  timedFetch(url, { method: init.method, headers: init.headers, body: new Uint8Array(init.body) }, PUSH_TIMEOUT_MS, async (res) => {
    await res.arrayBuffer().catch(() => null)
    return res.status
  })

/**
 * Канал push. Нет ключей или подписок, вид не для push или уже поздно
 * (pushView) — «пропущено». Подписок несколько — всем; временный сбой хоть на
 * одной — «не дошло» (повтор): уже получившим повтор не помешает — тот же tag
 * заменяет уведомление на экране, а не добавляет второе.
 *
 * Ключи читаются при каждой доставке (config — функция): dev-сервер кладёт
 * их в окружение уже после загрузки модулей (vite.config.ts).
 */
export function pushChannel(
  config: PushConfig | null | (() => PushConfig | null),
  send: PushSend = defaultSend,
  now: () => Date = () => new Date(),
): Channel {
  return {
    name: 'push',
    async deliver(n: OutgoingNotification): Promise<DeliveryResult> {
      const targets = (n.push ?? []).filter((t) => endpointOk(t.endpoint))
      if (!targets.length) return { outcome: 'skipped' }
      const cfg = typeof config === 'function' ? config() : config
      if (!cfg) {
        console.error('push: нет VITE_VAPID_PUBLIC_KEY или VAPID_PRIVATE_KEY — уведомления на телефоны не уходят')
        return { outcome: 'skipped' }
      }
      const view = pushView(n, now())
      if (!view) return { outcome: 'skipped' }
      const payload = JSON.stringify({ title: view.title, body: view.body, href: view.href, tag: view.tag })
      const outcomes = await Promise.all(targets.map((t) => sendOne(t, payload, view.ttl, view.urgency, cfg, send)))
      const gone = targets.filter((_, i) => outcomes[i] === 'gone').map((t) => t.endpoint)
      if (outcomes.includes('retry')) return { outcome: 'failed', gone }
      if (outcomes.includes('ok')) return { outcome: 'sent', gone }
      // только «подписок больше нет» и наши ошибки — повтор не поможет
      return { outcome: outcomes.includes('error') ? 'failed' : 'skipped', gone, retry: false }
    },
  }
}

async function sendOne(
  t: PushTarget, payload: string, ttl: number, urgency: 'high' | 'normal', cfg: PushConfig, send: PushSend,
): Promise<Outcome> {
  let req: ReturnType<typeof webpush.generateRequestDetails>
  try {
    req = webpush.generateRequestDetails({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, {
      vapidDetails: { subject: cfg.subject, publicKey: cfg.publicKey, privateKey: cfg.privateKey },
      TTL: ttl,
      urgency,
      contentEncoding: 'aes128gcm',
    })
  } catch (e) {
    // Негодные ключи ПОДПИСКИ («The subscription p256dh value should be 65
    // bytes long») — её не спасти, база удалит. Всё прочее (ключи VAPID —
    // «Vapid public key should be…») — наша настройка: подписки учеников
    // из-за неё удалять нельзя, повтор тоже не поможет.
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`push: запрос не собран — ${msg}`)
    return /subscription/i.test(msg) ? 'gone' : 'error'
  }
  try {
    const status = await send(req.endpoint, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.body as Buffer,
    })
    const outcome = classify(status)
    if (outcome === 'error') console.error(`push: служба ответила ${status} (${new URL(t.endpoint).hostname})`)
    return outcome
  } catch {
    // сбой связи или срок — повтор поможет
    return 'retry'
  }
}
