// ============================================================================
// Когда предложить включить уведомления (макет u3-3, u3-4; журнал п.68). Без
// базы и без браузера — чистый тест (scripts/test-my-lessons.mjs).
//
//   • только ученику, у которого есть уроки: обещание «напомним за час до
//     урока» без уроков ничего не значит;
//   • iPhone во вкладке Safari — не кнопка «Включить» (там push нет вовсе), а
//     инструкция «На экран Домой»;
//   • «Не сейчас» — переспросим один раз через 14 дней, потом — только из
//     Настроек: просьба, которая возвращается каждый день, — спам.
// ============================================================================
import type { PushSupport } from '../../shared/lib/push'

/** Что ответили на просьбу: когда и сколько раз отложили. */
export interface AskMemory {
  at: number
  count: number
}

export const ASK_AGAIN_DAYS = 14
/** После скольких «Не сейчас» больше не спрашиваем сами. */
export const ASK_MAX = 2

export type PushAsk = 'prompt' | 'install' | null

export function pushAsk(input: {
  support: PushSupport
  /** На этом устройстве уже есть подписка. */
  subscribed: boolean
  hasLessons: boolean
  asked: AskMemory | null
  now: number
}): PushAsk {
  const { support, subscribed, hasLessons, asked, now } = input
  if (!hasLessons) return null
  if (asked && (asked.count >= ASK_MAX || now - asked.at < ASK_AGAIN_DAYS * 86_400_000)) return null
  if (support === 'install') return 'install'
  // разрешено, но подписки нет (выключили в Настройках или вышли из аккаунта) —
  // тоже спрашиваем, а не подписываем молча: решение человека важнее
  if (support === 'default' || (support === 'granted' && !subscribed)) return 'prompt'
  return null
}

/** Отметить «Не сейчас». */
export function postpone(asked: AskMemory | null, now: number): AskMemory {
  return { at: now, count: (asked?.count ?? 0) + 1 }
}
