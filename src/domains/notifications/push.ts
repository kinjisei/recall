// ============================================================================
// Push на этом устройстве (PLAN.md Ф2.9): включить, выключить, подтвердить
// при открытии приложения, забыть при выходе из аккаунта. Браузерная часть —
// shared/lib/push.ts, запись в базу — api.ts.
//
// Подписку при открытии приложения только ПОДТВЕРЖДАЕМ (тот же адрес — новый
// seen_at, другой аккаунт на этом телефоне — подписка переходит к нему), но не
// создаём сами: выключил в Настройках — значит выключил.
// ============================================================================
import { readJson, writeJson } from '../../shared/lib/storage'
import { currentSubscription, keysOf, pushSupport, subscribePush, unsubscribePush, workerReady, type PushSupport } from '../../shared/lib/push'
import { deletePushSubscription, savePushSubscription } from './api'
import { postpone, type AskMemory } from './ask'

/** Публичный ключ VAPID сборки; без него push в этой сборке недоступен. */
const SERVER_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() || null
const ASKED_KEY = 'recall.push.asked'

export interface DevicePush {
  support: PushSupport
  subscribed: boolean
  /** Service worker готов: без него не подписаться (dev-сервер, первый заход). */
  ready: boolean
}

/**
 * Что умеет устройство, готово ли и подписано ли. Сборка без ключа — «не
 * умеет». Без готового service worker'а (dev-сервер, первый заход, пока он
 * ставится) включить нельзя — просьба «Включить» там хуже, чем никакой.
 */
export async function devicePush(): Promise<DevicePush> {
  const support = SERVER_KEY ? pushSupport() : 'unsupported'
  const ready = (support === 'default' || support === 'granted') && (await workerReady())
  if (support !== 'granted' || !ready) return { support, subscribed: false, ready }
  return { support, subscribed: (await currentSubscription().catch(() => null)) !== null, ready }
}

/**
 * Включить по нажатию «Включить» (окно разрешения — только из жеста).
 * on — включено и записано; denied — человек запретил; unsupported — не вышло.
 */
export async function enablePush(): Promise<'on' | 'denied' | 'unsupported'> {
  if (!SERVER_KEY) return 'unsupported'
  const keys = await subscribePush(SERVER_KEY)
  if (!keys) return pushSupport() === 'denied' ? 'denied' : 'unsupported'
  await savePushSubscription(keys)
  return 'on'
}

/** Выключить на этом устройстве: отписать браузер и забыть на сервере. */
export async function disablePush(): Promise<void> {
  const endpoint = await unsubscribePush()
  if (endpoint) await deletePushSubscription(endpoint)
}

/** При открытии приложения: подтвердить подписку этого устройства. Тихо, без ошибок. */
export async function syncPush(): Promise<void> {
  if (!SERVER_KEY || pushSupport() !== 'granted') return
  const sub = await currentSubscription().catch(() => null)
  const keys = sub && keysOf(sub)
  if (keys) await savePushSubscription(keys).catch(() => {})
}

/**
 * Перед выходом из аккаунта: на общем телефоне уроки прежнего человека не
 * должны приходить следующему. Не вышло забыть на сервере (нет связи) —
 * браузер всё равно отписан: служба push ответит «подписки нет», и база её
 * удалит сама.
 */
export async function forgetPushOnThisDevice(): Promise<void> {
  const sub = await currentSubscription().catch(() => null)
  if (!sub) return
  await deletePushSubscription(sub.endpoint).catch(() => {})
  await sub.unsubscribe().catch(() => false)
}

/** Сколько раз и когда отложили просьбу (у каждого, кто вошёл, своё — recall.*). */
export const askMemory = (): AskMemory | null => readJson<AskMemory | null>(ASKED_KEY, null)
export const rememberPostponed = (now = Date.now()): void => writeJson(ASKED_KEY, postpone(askMemory(), now))
