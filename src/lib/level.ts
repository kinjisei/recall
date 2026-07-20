// ============================================================================
// Уровень ученика в изучаемом языке — единая точка для игр и AI-промптов:
//   ES — localStorage (lib/esLevel, результат placement-теста);
//   EN — profiles.level в БД (онбординг или placement).
// null — уровень ещё не определён (вызывающий сам решает, что по умолчанию).
// ============================================================================
import { supabase } from './supabase'
import { getEsLevel } from './esLevel'
import type { AppLang } from '../types'

export async function getUserLevel(lang: AppLang): Promise<string | null> {
  if (lang === 'es') return getEsLevel()
  try {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return null
    const { data } = await supabase
      .from('profiles')
      .select('level')
      .eq('id', auth.user.id)
      .single()
    return (data?.level as string | null) ?? null
  } catch {
    return null
  }
}
