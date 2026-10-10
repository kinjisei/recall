// ============================================================================
// «Человек вернулся в приложение» — перечитать то, что могло устареть.
//
// Зачем (PLAN.md Ф2.11б-2). Учитель отправил приглашение в WhatsApp, ученик
// вошёл, учитель вернулся в Recall — а в «Учениках» всё ещё «без приложения»,
// пока не нажмёшь «Обновить». Так же расписание после переноса с другого
// устройства и «ждут проверки». PWA на телефоне живёт свёрнутым часами: без
// этого списки показывали вчерашнее.
//
// Возврат — вкладка снова видна (visibilitychange). Короткий выход (скопировал
// код, переключился на секунду) не считается: меньше minAwayMs — ничего не
// перечитываем, лишние запросы на каждое переключение ни к чему. Сам список
// при перечитывании остаётся на экране (useAsyncData не стирает данные).
// ============================================================================
import { useEffect, useRef } from 'react'

/** Полминуты: дольше, чем «скопировать и вернуться», короче, чем «ответили в чате». */
export const RETURN_AWAY_MS = 30_000

export function useOnReturn(onReturn: () => void, minAwayMs = RETURN_AWAY_MS): void {
  // экран пересоздаёт функцию на каждую отрисовку — подписка от неё не зависит
  const fn = useRef(onReturn)
  useEffect(() => {
    fn.current = onReturn
  })
  useEffect(() => {
    let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : null
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= minAwayMs) fn.current()
      hiddenAt = null
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [minAwayMs])
}
