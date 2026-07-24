// ============================================================================
// Кэш профиля пользователя на сессию.
// Профиль нужен сразу нескольким местам (Главная, меню аватара, уровень для
// игр) — без кэша каждый экран делал свой запрос к profiles за тем же рядом.
// После изменения профиля (экран «Настройки») вызвать invalidateProfile().
// ============================================================================
import { supabase } from './supabase'
import type { Profile } from '../types'

let cache: { userId: string; promise: Promise<Profile | null> } | null = null

const LEVEL_CACHE_KEY = 'recall.en_level_cache'

/**
 * Мгновенный уровень EN из localStorage — чтобы строки вроде «Твой уровень»
 * рендерились сразу, без ожидания запроса профиля. null — уровня нет,
 * undefined — кэш пуст (первый запуск на устройстве).
 */
export function getCachedEnLevel(): string | null | undefined {
  try {
    const v = localStorage.getItem(LEVEL_CACHE_KEY)
    if (v === null) return undefined
    return v === '' ? null : v
  } catch {
    return undefined
  }
}

/**
 * Колонки профиля, доступные клиенту. Перечислены явно, а не '*': с захода 20
 * SELECT на profiles разрешён грантом только на этот список, и '*' падает с
 * ошибкой прав. Секреты (invite_code, plan, trial_until, is_admin) через REST
 * не читаются вовсе — их отдают RPC get_my_plan() и ensure_invite_code().
 */
export const PROFILE_COLUMNS = 'id, display_name, level, native_lang, role, created_at'

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single()
  if (error) return null
  const profile = data as Profile
  try {
    localStorage.setItem(LEVEL_CACHE_KEY, profile.level ?? '')
  } catch {
    /* приватный режим */
  }
  return profile
}

/** Профиль пользователя (кэш в памяти на сессию — повторные вызовы без запроса). */
export function getProfile(userId: string): Promise<Profile | null> {
  if (cache?.userId === userId) return cache.promise
  const entry = {
    userId,
    promise: fetchProfile(userId).then((p) => {
      // null = ошибка или нет ряда — не кэшируем, следующий вызов повторит запрос
      if (p === null && cache === entry) cache = null
      return p
    }),
  }
  cache = entry
  return entry.promise
}

/** Сбросить кэш — после сохранения настроек профиля или смены пользователя. */
export function invalidateProfile(): void {
  cache = null
}

/** Полная очистка (выход из аккаунта): и память, и localStorage-кэш уровня. */
export function clearProfileCaches(): void {
  cache = null
  try {
    localStorage.removeItem(LEVEL_CACHE_KEY)
  } catch {
    /* некритично */
  }
}
