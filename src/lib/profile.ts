// ============================================================================
// Кэш профиля пользователя на сессию.
// Профиль нужен сразу нескольким местам (Главная, меню аватара, уровень для
// игр) — без кэша каждый экран делал свой запрос к profiles за тем же рядом.
// После изменения профиля (экран «Настройки») вызвать invalidateProfile().
// ============================================================================
import { supabase } from './supabase'
import type { Profile } from '../types'

let cache: { userId: string; promise: Promise<Profile | null> } | null = null

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data as Profile
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
