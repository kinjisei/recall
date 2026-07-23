// ============================================================================
// Уровень ученика в изучаемом языке — единая точка для игр и AI-промптов:
//   ES — localStorage (lib/esLevel, результат placement-теста);
//   EN — profiles.level в БД (онбординг или placement).
// null — уровень ещё не определён (вызывающий сам решает, что по умолчанию).
// ============================================================================
import { supabase } from './supabase'
import { getProfile } from './profile'
import { getEsLevel } from './esLevel'
import type { AppLang } from '../types'

export async function getUserLevel(lang: AppLang): Promise<string | null> {
  if (lang === 'es') return getEsLevel()
  try {
    // getSession читает локально (без сети), профиль — из общего кэша
    const { data } = await supabase.auth.getSession()
    const uid = data.session?.user.id
    if (!uid) return null
    const profile = await getProfile(uid)
    return profile?.level ?? null
  } catch {
    return null
  }
}
