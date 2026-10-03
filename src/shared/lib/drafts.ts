// ============================================================================
// Черновики набранного текста (PLAN.md Ф1.14).
//
// Зачем. Новая версия PWA включается сразу и перезагружает страницу (журнал
// п.58) — по возврату в приложение или ежечасной проверке. Ни один экран не
// хранил набранное: сочинение, ответы домашки, отчёт родителям пропадали.
// Та же беда — случайное обновление, севший телефон, выгруженная вкладка.
//
// Правила:
//   • ключ — владелец + экран + задание: на общем телефоне (учитель и
//     ученики) черновик не достаётся другому; при выходе из аккаунта все
//     recall.* стирает clearUserLocalData (lib/profile), черновики тоже;
//   • без владельца (не вошёл) черновики не пишутся и не читаются;
//   • живёт до отправки, но не дольше DRAFT_TTL_MS с последней правки —
//     брошенный месяц назад текст не всплывает (решение владельца, журнал п.59);
//   • пустое значение — не черновик: стирается.
//
// Модуль без импортов: его проверяет чистый тест scripts/test-drafts.mjs.
// Хук для экранов — useDraft.
// ============================================================================

export const DRAFT_PREFIX = 'recall.draft.'
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Часть Storage, нужная черновикам (в тесте — подделка в памяти). */
export interface DraftStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  key(index: number): string | null
  readonly length: number
}

let owner: string | null = null

/** Чьи черновики: модуль входа ставит при входе, снимает при выходе. */
export function setDraftOwner(id: string | null): void {
  owner = id
}

function defaultStore(): DraftStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null // приватный режим — черновиков просто нет
  }
}

const keyOf = (scope: string) => `${DRAFT_PREFIX}${owner}.${scope}`

/**
 * Пустое — не черновик: пустая или пробельная строка, null, объект или массив,
 * где всё пустое (форма «название + текст» без единой буквы). Числа и флаги
 * сами по себе пустыми не считаются.
 */
export function isEmptyDraft(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.every(isEmptyDraft)
  if (typeof value === 'object') return Object.values(value).every(isEmptyDraft)
  return false
}

/** Черновик этого экрана или null (нет, чужой, протух, битый). */
export function readDraft<T>(scope: string, now = Date.now(), store = defaultStore()): T | null {
  if (!owner || !store) return null
  const key = keyOf(scope)
  try {
    const raw = store.getItem(key)
    if (raw === null) return null
    const saved = JSON.parse(raw) as { v: T; at: number }
    if (typeof saved?.at !== 'number' || now - saved.at > DRAFT_TTL_MS || isEmptyDraft(saved.v)) {
      store.removeItem(key)
      return null
    }
    return saved.v
  } catch {
    return null
  }
}

/** Сохранить черновик; пустое значение черновик стирает. */
export function writeDraft(scope: string, value: unknown, now = Date.now(), store = defaultStore()): void {
  if (!owner || !store) return
  try {
    if (isEmptyDraft(value)) store.removeItem(keyOf(scope))
    else store.setItem(keyOf(scope), JSON.stringify({ v: value, at: now }))
  } catch {
    /* переполнение — черновик не сохранится, экран работает */
  }
}

/** Стереть черновик (отправлено или «Очистить»). */
export function clearDraft(scope: string, store = defaultStore()): void {
  if (!owner || !store) return
  try {
    store.removeItem(keyOf(scope))
  } catch {
    /* некритично */
  }
}

/** Убрать протухшие черновики всех владельцев — брошенные экраны их сами не прочтут. */
export function purgeOldDrafts(now = Date.now(), store = defaultStore()): number {
  if (!store) return 0
  const old: string[] = []
  try {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i)
      if (!k?.startsWith(DRAFT_PREFIX)) continue
      try {
        const at = (JSON.parse(store.getItem(k) ?? '') as { at?: unknown }).at
        if (typeof at !== 'number' || now - at > DRAFT_TTL_MS) old.push(k)
      } catch {
        old.push(k) // битый — тоже мусор
      }
    }
    old.forEach((k) => store.removeItem(k))
  } catch {
    /* некритично */
  }
  return old.length
}
