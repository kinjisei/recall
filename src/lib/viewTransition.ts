// ============================================================================
// Плавная смена экрана средствами браузера (View Transitions API).
//
// Зачем. Внутренние экраны менялись мгновенной подменой: список исчез, экран
// появился. Это главное, чем веб-страница отличается от приложения, — и это
// единственная «анимация», которую замечают все, а не только те, кто дошёл до
// конкретного экрана.
//
// Почему не библиотека. Тот же эффект даёт браузер бесплатно. Framer Motion
// стоил бы примерно треть нашего стартового бандла (105 КБ gzip) ради того,
// что здесь делается тридцатью строками.
//
// Где НЕ поддерживается (старый Safari, Firefox до 144) — переход просто не
// играет, содержимое меняется как раньше. Ломаться нечему.
// ============================================================================
import { flushSync } from 'react-dom'

interface ViewTransition {
  /** Снимок готов, анимация вот-вот пойдёт. Отклоняется, если переход прерван. */
  ready: Promise<void>
  /** Колбэк обновления отработал. */
  updateCallbackDone: Promise<void>
  /** Анимация доиграла. */
  finished: Promise<void>
}
type DocWithVT = Document & {
  startViewTransition?: (cb: () => void) => ViewTransition
}

/**
 * Проглотить отказ промиса перехода.
 *
 * ⚠️ Обязательно для КАЖДОГО из трёх: если браузер прерывает переход (вкладка
 * в фоне, поверх начался новый переход), промисы отклоняются, и любой без
 * обработчика становится необработанным отказом — в консоли пользователя
 * появляется красная ошибка на ровном месте. Поймано смоуком навигации:
 * «InvalidStateError: Transition was aborted because of invalid state»
 * прилетал из `ready`, за которым я не следил вовсе.
 *
 * Прерванный переход — не проблема: браузер всё равно вызывает колбэк
 * обновления, то есть экран меняется. Поэтому отдельного сторожа на скрытую
 * вкладку нет: он только маскировал бы этот путь (и делал непроверяемым —
 * в headless вкладка как раз считается скрытой).
 */
function ignore(p: Promise<unknown>): void {
  p.catch(() => {})
}

/** Заход внутрь или возврат наружу — от этого зависит, куда едет экран. */
export type TransitionDirection = 'in' | 'out'

/** Настройка «уменьшить движение» — читаем при каждом переходе: её меняют на ходу. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Выполнить смену экрана с переходом.
 *
 * @param direction 'in' — заход внутрь (новый экран приезжает справа),
 *                  'out' — возврат (приезжает слева)
 * @param update    само изменение состояния (setSearchParams и т.п.)
 *
 * ⚠️ flushSync обязателен: браузер снимает «после» сразу по возврату из
 * колбэка, а обычный setState к этому моменту ещё не отрисован — вторым кадром
 * оказался бы старый экран, и переход бы не сыграл.
 *
 * ⚠️ Направление кладём на <html> атрибутом, а не в CSS-переменную: правила
 * ::view-transition-* живут вне дерева документа и до переменных элемента не
 * дотягиваются.
 */
export function withViewTransition(direction: TransitionDirection, update: () => void): void {
  const doc = document as DocWithVT

  if (typeof doc.startViewTransition !== 'function' || prefersReducedMotion()) {
    update()
    return
  }

  const root = doc.documentElement
  root.dataset.vt = direction

  let transition: ViewTransition
  try {
    transition = doc.startViewTransition(() => {
      flushSync(update)
    })
  } catch {
    // Переход — украшение. Если браузер по какой-то причине не смог его
    // начать, экран обязан смениться всё равно.
    delete root.dataset.vt
    update()
    return
  }

  ignore(transition.ready)
  ignore(transition.updateCallbackDone)

  const clear = () => {
    delete root.dataset.vt
  }
  transition.finished.then(clear, clear)
}
