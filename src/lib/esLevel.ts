// ============================================================================
// Уровень испанского пользователя (результат placement-теста).
//
// Читаем СИНХРОННО из localStorage (recall.es_level) — так уровень доступен
// сразу множеству экранов без async. Но храним ДОЛГОВЕЧНО: setEsLevel пишет и
// в profiles.es_level (write-through), а при загрузке профиля значение с сервера
// подтягивается в кэш нового устройства (hydrateEsLevel). Английский уровень
// давно живёт в profiles.level — испанский теперь так же переживает смену
// устройства/браузера.
// ============================================================================
import { readRaw, writeRaw } from './storage'
import { supabase, currentUserId } from './supabase'
import type { CEFRLevel } from '../types'

const KEY = 'recall.es_level'

const VALID: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const isLevel = (v: string | null | undefined): v is CEFRLevel =>
  !!v && (VALID as string[]).includes(v)

/** Сохранённый уровень испанского, либо null (тест ещё не пройден). */
export function getEsLevel(): CEFRLevel | null {
  const v = readRaw(KEY)
  return isLevel(v) ? v : null
}

export function setEsLevel(level: CEFRLevel): void {
  writeRaw(KEY, level)
  // write-through в профиль: не ждём ответа (экран не должен зависеть от сети),
  // ошибку глотаем — локальное значение уже сохранено.
  void currentUserId().then((uid) => {
    if (uid) void supabase.from('profiles').update({ es_level: level }).eq('id', uid)
  })
}

/**
 * Свести localStorage и профиль. Зовётся при загрузке профиля (lib/profile).
 *   • на сервере есть уровень, локально нет → кладём в кэш (новое устройство);
 *   • локально есть, на сервере нет → поднимаем локальный в профиль (миграция
 *     значений, записанных до появления колонки es_level).
 * Если оба есть — доверяем локальному (последнее действие было на этом
 * устройстве), профиль не трогаем.
 */
export function hydrateEsLevel(dbLevel: CEFRLevel | null | undefined): void {
  const local = getEsLevel()
  if (isLevel(dbLevel) && !local) {
    writeRaw(KEY, dbLevel)
  } else if (local && !isLevel(dbLevel)) {
    setEsLevel(local) // подтолкнём в профиль
  }
}
