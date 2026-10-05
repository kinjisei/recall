// ============================================================================
// Кэш профиля пользователя на сессию.
// Профиль нужен сразу нескольким местам (Главная, меню аватара, уровень для
// игр) — без кэша каждый экран делал свой запрос к profiles за тем же рядом.
// После изменения профиля (экран «Настройки») вызвать invalidateProfile().
// ============================================================================
import { supabase } from '../shared/api/supabase'
import { readJson, readRaw, writeJson, writeRaw } from '../shared/lib/storage'
import type { Profile } from '../types'

let cache: { userId: string; promise: Promise<Profile | null> } | null = null

const LEVEL_CACHE_KEY = 'recall.en_level_cache'
const ROLE_CACHE_KEY = 'recall.role'

/**
 * Роль из прошлого ответа базы на этом устройстве (PLAN.md Ф2.10): меню и
 * стартовый экран зависят от роли, и без кэша учитель при каждом запуске
 * видел бы меню ученика, пока идёт запрос, а без сети — всё время. Роль —
 * вместе с тем, чья она. undefined — не знаем (кэша нет или он чужой); при
 * выходе стирается вместе с остальными данными аккаунта.
 */
export function getCachedRole(userId: string): string | null | undefined {
  const v = readJson<{ id?: string; role?: string | null } | null>(ROLE_CACHE_KEY, null)
  return v?.id === userId ? (v.role ?? null) : undefined
}

/**
 * Мгновенный уровень EN из localStorage — чтобы строки вроде «Твой уровень»
 * рендерились сразу, без ожидания запроса профиля. null — уровня нет,
 * undefined — кэш пуст (первый запуск на устройстве).
 */
export function getCachedEnLevel(): string | null | undefined {
  const v = readRaw(LEVEL_CACHE_KEY)
  if (v === null) return undefined
  return v === '' ? null : v
}

/**
 * Колонки профиля, доступные клиенту. Перечислены явно, а не '*': с захода 20
 * SELECT на profiles разрешён грантом только на этот список, и '*' падает с
 * ошибкой прав. Секреты (invite_code, plan, trial_until, is_admin) через REST
 * не читаются вовсе — их отдают RPC get_my_plan() и ensure_invite_code().
 */
export const PROFILE_COLUMNS = 'id, display_name, level, native_lang, role, created_at, goal'
/** Без колонок, которые могли ещё не приехать в базу (см. fetchProfile). */
const PROFILE_COLUMNS_BASE = 'id, display_name, level, native_lang, role, created_at'

/**
 * Запрос к profiles, переживающий отставание базы от кода.
 *
 * ⚠️ Профиль читает КАЖДЫЙ экран. Если запросить колонку, которой в базе ещё
 * нет (код выкатился раньше миграции — а порядок мы не контролируем), запрос
 * падает целиком, и приложение ложится у всех сразу: пропадают роль, уровень,
 * студия преподавателя. Поймано смоуком навигации ДО пуша.
 *
 * Поэтому запрос делается дважды: сначала с полным набором колонок, а если
 * база отвечает «нет такой колонки» — базовым набором, который есть всегда.
 */
export async function selectProfiles<T>(
  run: (columns: string) => PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>,
): Promise<{ data: T | null; error: { code?: string; message?: string } | null }> {
  const first = await run(PROFILE_COLUMNS)
  const missingColumn =
    first.error?.code === '42703' || /column .*goal/i.test(first.error?.message ?? '')
  return missingColumn ? await run(PROFILE_COLUMNS_BASE) : first
}

/** null — ряда нет (PGRST116 у .single()); сбой связи или базы — бросает. */
async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await selectProfiles<Profile>((cols) =>
    supabase.from('profiles').select(cols).eq('id', userId).single() as never,
  )
  if (error?.code === 'PGRST116' || (!error && !data)) return null
  if (error) throw error
  const profile = data as Profile
  writeRaw(LEVEL_CACHE_KEY, profile.level ?? '')
  writeJson(ROLE_CACHE_KEY, { id: userId, role: profile.role ?? null })
  return profile
}

/**
 * Профиль, который ОТЛИЧАЕТ «нет связи» от «профиля нет» (PLAN.md Ф1.13):
 * сбой — исключение, null — ряда действительно нет. Нужен там, где ошибку
 * нельзя принять за пустоту: без сети студия показывала учителю «Включи
 * режим преподавателя». Кэш общий с getProfile.
 */
export function loadProfile(userId: string): Promise<Profile | null> {
  if (cache?.userId === userId) return cache.promise
  const entry = {
    userId,
    promise: fetchProfile(userId).then(
      (p) => {
        // ряда нет — не кэшируем, следующий вызов повторит запрос
        if (p === null && cache === entry) cache = null
        return p
      },
      (e: unknown) => {
        if (cache === entry) cache = null
        throw e
      },
    ),
  }
  cache = entry
  return entry.promise
}

/** Профиль пользователя (кэш в памяти на сессию); сбой связи — тоже null. */
export function getProfile(userId: string): Promise<Profile | null> {
  return loadProfile(userId).catch(() => null)
}

/**
 * Имена учеников одним запросом (RLS «linked profiles visible») — для
 * списков учителя: «На проверку», «Проверка работ». Сбой — пустая карта:
 * список покажет «Ученик», а не упадёт целиком из-за подписи.
 */
export async function displayNames(ids: string[]): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map()
  const { data } = await supabase.from('profiles').select('id, display_name').in('id', ids)
  return new Map((data ?? []).map((p) => [p.id as string, p.display_name as string | null]))
}

const PROFILE_CHANGED = 'recall:profile-changed'

/**
 * Сбросить кэш — после сохранения настроек профиля или смены роли. Каркас
 * (меню профиля, подарок-рефералка, вкладки по роли) при переходах не
 * пересоздаётся и без сигнала показывал бы прежнюю роль до перезагрузки:
 * стал репетитором по ссылке-приглашению — а подарка в шапке нет.
 */
export function invalidateProfile(): void {
  cache = null
  // и прошлую роль: выключил режим репетитора — страница перезагружается
  // раньше, чем профиль перечитан, и старая роль увела бы в расписание
  writeJson(ROLE_CACHE_KEY, null)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROFILE_CHANGED))
}

/** Подписка на invalidateProfile; возвращает отписку. */
export function onProfileChanged(listener: () => void): () => void {
  window.addEventListener(PROFILE_CHANGED, listener)
  return () => window.removeEventListener(PROFILE_CHANGED, listener)
}

// Ключи localStorage, которые ОСТАЮТСЯ при выходе — это настройки устройства,
// а не данные аккаунта: язык интерфейса, скорость озвучки/размер текста,
// защита от циклической перезагрузки PWA. Всё остальное с префиксом recall.*
// — данные пользователя (уровень, банки ошибок, «Мои тексты», кэши) — стирается.
const DEVICE_PREF_KEYS = new Set([
  'recall.lang',
  'recall.settings',
  'recall.chunk_reload_at',
])

/**
 * Полная очистка при выходе из аккаунта: память + ВСЕ пользовательские ключи
 * localStorage (кроме настроек устройства). Раньше чистился только кэш уровня —
 * на общем телефоне (кейс «преподаватель + ученики») следующий вошедший видел
 * чужие «Мои тексты», уровень и банк ошибок. Ключи не привязаны к user_id,
 * поэтому единственный надёжный способ разделения — стереть при выходе.
 */
export function clearUserLocalData(): void {
  cache = null
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('recall.') && !DEVICE_PREF_KEYS.has(k)) toRemove.push(k)
    }
    for (const k of toRemove) localStorage.removeItem(k)
  } catch {
    /* приватный режим — некритично */
  }
}
