// ============================================================================
// Нужен ли пользователю онбординг.
//
// Живёт в lib, а не внутри features/onboarding/OnboardingFlow: эту функцию
// импортирует ProtectedRoute, который рендерится всегда. Пока она лежала
// рядом с экраном, статический импорт тянул весь OnboardingFlow (302 строки)
// в главный бандл и обнулял его lazy() — сборка ругалась
// INEFFECTIVE_DYNAMIC_IMPORT.
// ============================================================================
import { supabase, currentUserId } from './supabase'

const KEY = 'recall.onboarded'

/** Уже прошёл онбординг (синхронно, без сети). */
export function isOnboarded(): boolean {
  return localStorage.getItem(KEY) !== null
}

/** Отметить онбординг пройденным. */
export function markOnboarded(): void {
  localStorage.setItem(KEY, '1')
}

/**
 * Новичок ли это: онбординг ещё не пройден и активности в приложении нет.
 * Проверка активности защищает существующих пользователей — им онбординг
 * не покажется, даже если локальный флаг потерялся (новое устройство,
 * очистка данных).
 *
 * Fail-closed по смыслу: при любой ошибке возвращаем false, то есть
 * НЕ уводим человека из приложения на онбординг из-за сбоя сети.
 */
export async function shouldOnboard(): Promise<boolean> {
  if (isOnboarded()) return false
  try {
    const userId = await currentUserId()
    if (!userId) return false

    const { count, error } = await supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    if (error) return false

    if ((count ?? 0) > 0) {
      markOnboarded()
      return false
    }
    return true
  } catch {
    return false
  }
}
