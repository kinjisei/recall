// ============================================================================
// Push в браузере — без предметной логики (PLAN.md Ф2.9): умеет ли устройство,
// разрешил ли человек, подписаться и отписаться. Кому и о чём писать, решает
// домен уведомлений.
//
// Умеет ли — по возможностям, а не по названию браузера: есть ли service
// worker, PushManager и Notification. Исключение одно и честное: iPhone в
// обычной вкладке Safari push не умеет вовсе — только приложение с экрана
// «Домой» (iOS 16.4+). Узнаём его по navigator.standalone — это свойство есть
// только у Safari на iOS.
//
// Service worker в dev-сервере не регистрируется — тогда «не умеет», а не
// вечное ожидание navigator.serviceWorker.ready.
// ============================================================================

/**
 * unsupported — нельзя совсем; install — iPhone во вкладке: сначала «На экран
 * Домой»; denied — человек запретил (вернуть можно только в настройках
 * браузера); default — ещё не спрашивали; granted — разрешено.
 */
export type PushSupport = 'unsupported' | 'install' | 'denied' | 'default' | 'granted'

export interface PushKeys {
  endpoint: string
  p256dh: string
  auth: string
}

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'unsupported'
  const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!capable) {
    const iosTab = 'standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone !== true
    return iosTab ? 'install' : 'unsupported'
  }
  return Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'default'
}

/** Регистрация service worker'а или null (dev-сервер, браузер без SW). */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

/**
 * Готов ли service worker — ждём не дольше ms. На самом первом заходе он
 * ещё ставится; у dev-сервера его нет вовсе (ready не наступит никогда).
 */
export async function workerReady(ms = 3000): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false
  const timeout = new Promise<false>((r) => setTimeout(() => r(false), ms))
  return Promise.race([navigator.serviceWorker.ready.then(() => true), timeout])
}

/** Ключи подписки, как их ждёт сервер (base64url). */
export function keysOf(sub: PushSubscription): PushKeys | null {
  const json = sub.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  return json.endpoint && p256dh && auth ? { endpoint: json.endpoint, p256dh, auth } : null
}

/** Подписка этого устройства или null. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration()
  return reg ? reg.pushManager.getSubscription() : null
}

/** base64url → байты (applicationServerKey). */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const bin = atob(base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4))
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * Спросить разрешение и подписаться. Звать ТОЛЬКО из нажатия человека: iPhone
 * без жеста окно разрешения не покажет. null — не разрешили или не вышло.
 * Подписка на другой ключ сервера (сменили пару) пересоздаётся.
 */
export async function subscribePush(serverKey: string): Promise<PushKeys | null> {
  if (pushSupport() === 'unsupported' || pushSupport() === 'install') return null
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null
  const reg = await registration()
  if (!reg) return null
  const key = keyBytes(serverKey)
  let sub = await reg.pushManager.getSubscription()
  const old = sub?.options.applicationServerKey
  if (sub && old && !sameBytes(new Uint8Array(old), key)) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  return keysOf(sub)
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

/** Отписать это устройство. Адрес бывшей подписки — чтобы забыть её и на сервере. */
export async function unsubscribePush(): Promise<string | null> {
  const sub = await currentSubscription()
  if (!sub) return null
  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => false)
  return endpoint
}
