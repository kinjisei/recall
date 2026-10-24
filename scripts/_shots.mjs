// Снимки экранов для владельца — общий порядок для смоуков: сперва данные
// (waitForData), потом анимации.
//
// Экраны появляются анимацией (fade-up с задержкой до ~0,8 с). Снимок,
// сделанный раньше, показывает полупрозрачный текст — и владелец видит
// «надписи не видно» там, где всё в порядке (приёмка Ф2.11б-1, левая
// половина входа на компьютере). Дождаться анимаций мало: снимок всей
// страницы (fullPage) сам перезапускает их — на время снимка браузер
// меняет размер окна (замер 09.10.2026: после finish() и снимка fullPage
// анимации снова running). Поэтому на время снимка длительность и задержка
// всех анимаций — ноль, после снимка стиль убирается: тосты с полоской
// времени и переходы на следующих шагах смоука работают как обычно.

const NO_MOTION = '*,*::before,*::after{animation-delay:0s!important;animation-duration:0s!important;transition-duration:0s!important;transition-delay:0s!important}'

/**
 * Доиграть конечные анимации до последнего кадра — для снимков элемента,
 * где окно не меняется. Бесконечные (пятна «авроры», крутилки) не трогаем:
 * finish() на них бросает исключение.
 */
export async function settleAnimations(page) {
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish()
    }
  })
}

/**
 * Дождаться данных: на экране не осталось заглушек загрузки (серые полосы
 * animate-pulse у блоков экранов и animate-skeleton общего RowsSkeleton, не
 * у значков-подсказок). Проверка смоука может
 * дождаться одного элемента, а соседний блок ещё грузится — и снимок ловил
 * заглушку вместо приглашения и «Ближайших» (приёмка Ф2.11, снимок 07 на
 * 1280). Не дождались за `ms` — снимаем как есть: сбой тоже надо видеть, —
 * но вслух: false, и `settledScreenshot` пишет «⚠ заглушка» (в 4д-3 снимок
 * «Письменных заданий» вышел со списком-заглушкой, а в итоге стояло ✓).
 */
export async function waitForData(page, ms = 10_000) {
  return page
    .waitForFunction(() => !document.querySelector('main :is(div, span):is(.animate-pulse, .animate-skeleton)'), { polling: 250, timeout: ms })
    .then(() => true, () => false)
}

/** page.screenshot(options), но экран — в конечном виде: данные пришли, надписи проявились. */
export async function settledScreenshot(page, options) {
  if (!(await waitForData(page))) console.log(`⚠ заглушка загрузки не ушла за 10 с — снимок с ней: ${options?.path ?? '(без файла)'}`)
  const style = await page.addStyleTag({ content: NO_MOTION })
  try {
    await settleAnimations(page)
    return await page.screenshot(options)
  } finally {
    await style.evaluate((el) => el.remove()).catch(() => {})
  }
}
