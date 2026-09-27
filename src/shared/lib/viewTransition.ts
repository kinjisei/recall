// ============================================================================
// Плавная смена экрана средствами браузера (View Transitions API).
//
// Зачем. Внутренние экраны и вкладки менялись мгновенной подменой: список
// исчез, экран появился. Это главное, чем веб-страница отличается от
// приложения, — и единственная «анимация», которую замечают все.
//
// Почему не библиотека. Тот же эффект даёт браузер бесплатно. Framer Motion
// стоил бы примерно треть нашего стартового бандла ради того, что здесь
// делается несколькими десятками строк.
//
// Где API нет (старый Safari, Firefox до 144) — переход не играет, содержимое
// меняется как раньше. Ломаться нечему.
// ============================================================================

interface ViewTransition {
  /** Снимок готов, анимация вот-вот пойдёт. Отклоняется, если переход прерван. */
  ready: Promise<void>
  /** Колбэк обновления отработал. */
  updateCallbackDone: Promise<void>
  /** Анимация доиграла. */
  finished: Promise<void>
}
type DocWithVT = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => ViewTransition
}

/** Заход внутрь или возврат наружу — от этого зависит, куда едет экран. */
export type TransitionDirection = 'in' | 'out'

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
 * Прерванный переход не страшен: браузер всё равно вызывает колбэк обновления,
 * то есть экран меняется.
 */
function ignore(p: Promise<unknown>): void {
  p.catch(() => {})
}

/** Настройка «уменьшить движение» — читаем при каждом переходе: её меняют на ходу. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Дождаться, пока страница действительно перерисуется.
 *
 * ⚠️ Это НЕ перестраховка, а суть всей затеи. Браузер снимает «новый» кадр
 * сразу по возврату из колбэка. React Router откладывает своё обновление через
 * `startTransition`, и `flushSync` его НЕ продавливает — то есть на момент
 * возврата DOM ещё старый. Первая версия этого файла так и работала: переход
 * исправно запускался, снимал два ОДИНАКОВЫХ кадра, красиво их смешивал, а
 * настоящая смена экрана происходила уже после — рывком. Счётчик вызовов при
 * этом был зелёный. Поймано пробой, которая сравнивала DOM до и внутри колбэка.
 *
 * Ждём, пока правки DOM прекратятся на `quiet` мс (значит React дописал),
 * но не дольше `cap`. Заодно это переживает мигание заглушки Suspense: она
 * успевает смениться настоящим экраном внутри окна ожидания.
 *
 * Только таймеры, никаких requestAnimationFrame: в фоновой вкладке кадры не
 * выдаются вовсе, и обещание не разрешилось бы никогда.
 */
function domSettled(quiet = 50, cap = 260): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MutationObserver !== 'function') {
      setTimeout(resolve, quiet)
      return
    }
    let done = false
    let quietTimer = 0
    const finish = () => {
      if (done) return
      done = true
      observer.disconnect()
      clearTimeout(quietTimer)
      clearTimeout(hardTimer)
      resolve()
    }
    const observer = new MutationObserver(() => {
      clearTimeout(quietTimer)
      quietTimer = window.setTimeout(finish, quiet)
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    quietTimer = window.setTimeout(finish, quiet)
    const hardTimer = window.setTimeout(finish, cap)
  })
}

/**
 * Выполнить смену экрана с переходом.
 *
 * @param direction 'in' — вперёд (новый экран приезжает справа),
 *                  'out' — назад (приезжает слева)
 * @param update    само изменение состояния (navigate, setSearchParams…)
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
      update()
      return domSettled()
    })
  } catch {
    // Переход — украшение. Не смог начаться — экран обязан смениться всё равно.
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
