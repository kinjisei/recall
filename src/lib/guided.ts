// ============================================================================
// «Начать занятие» — короткая ведомая сессия: колода → чтение → речь.
// Намеренно без state-менеджера: шаг лежит в sessionStorage, каждый экран в
// конце спрашивает peekNextStep() и, если сессия идёт, показывает кнопку
// перехода к следующему шагу. Закрыл вкладку — сессия просто забылась.
// ============================================================================

import { countMyWords } from './cards'
import type { AppLang } from '../types'

const KEY = 'recall.guided'

/**
 * Шаг, на который человека УЖЕ увели автоматически.
 *
 * ⚠️ Без этой отметки сессия превращалась в ловушку. Шаг переключается только
 * по нажатию на баннер (advanceGuided), то есть когда раунд доведён до конца и нажато
 * «Дальше». Бросил на середине — шаг навсегда остался прежним, и КАЖДЫЙ вход в
 * «Практику» снова кидал в повторение; нижней навигации в раунде нет, выйти
 * можно только кареткой. Человек, решивший заняться другим, упирался в это
 * бесконечно (жалоба владельца: «приходилось выходить, чтобы выбрать что-то
 * другое»). Симптом выглядел плавающим, потому что sessionStorage очищается
 * при закрытии вкладки.
 *
 * Теперь автоперехват срабатывает РОВНО ОДИН РАЗ на шаг — сразу после
 * «Начать занятие». Сама сессия живёт дальше: кнопка «Дальше» на экране
 * результата работает как раньше.
 */
const OPENED_KEY = 'recall.guided.opened'

/** Порядок шагов ведомой сессии. */
export const GUIDED_STEPS = ['flashcards', 'reader', 'pronunciation'] as const
export type GuidedStep = (typeof GUIDED_STEPS)[number]

const ROUTES: Record<GuidedStep, string> = {
  flashcards: '/practice', // хаб «Практика» откроет повторение сам (guided-шаг)
  reader: '/study?view=reader', // сразу к текстам, минуя хаб «Учёбы»
  pronunciation: '/pronunciation',
}

const TITLES: Record<GuidedStep, string> = {
  flashcards: 'повторение слов',
  reader: 'чтение',
  pronunciation: 'речь',
}

/** Начать сессию с первого шага. */
export function startGuided(): string {
  sessionStorage.setItem(KEY, GUIDED_STEPS[0])
  // новая сессия — право на автопереход возвращается
  sessionStorage.removeItem(OPENED_KEY)
  return ROUTES[GUIDED_STEPS[0]]
}

/**
 * Куда вести сессию НА САМОМ ДЕЛЕ — решаем до перехода.
 *
 * Раньше «Начать занятие» всегда уводило на хаб «Практика», и только там,
 * двумя запросами, выяснялось, что слов у человека нет и шаг надо пропустить.
 * Замер ревью 1А: ~5 секунд человек смотрел на меню из двенадцати плиток, а
 * потом экран менялся сам. Если за это время он успевал ткнуть в плитку —
 * его выкидывало.
 *
 * Теперь проверка идёт ДО навигации: обещание «мы тебя проведём» выполняется
 * с первого экрана. Сбой запроса не блокирует — ведём сессию как обычно.
 */
export async function startGuidedRoute(lang: AppLang): Promise<string> {
  startGuided()
  try {
    if ((await countMyWords(lang)) === 0) {
      sessionStorage.setItem(KEY, 'reader')
      return ROUTES.reader
    }
  } catch {
    /* не смогли проверить — обычный порядок шагов */
  }
  return ROUTES[GUIDED_STEPS[0]]
}

/**
 * Guided-вход в «Практику»: у новичка без единого слова шаг «повторение»
 * пустой и только обескураживает — пропускаем его и начинаем сессию с чтения
 * (где слова как раз и собираются). Зовётся из PracticePage при guided-входе.
 * Возвращает маршрут чтения, если шаг пропущен, иначе null — идём в повторение.
 */
export async function skipReviewIfNoWords(lang: AppLang): Promise<string | null> {
  if (currentGuidedStep() !== 'flashcards') return null
  try {
    if ((await countMyWords(lang)) > 0) return null
  } catch {
    return null // не смогли проверить — ведём сессию как обычно
  }
  sessionStorage.setItem(KEY, 'reader')
  return ROUTES.reader
}

/** Идёт ли сессия и на каком шаге. */
export function currentGuidedStep(): GuidedStep | null {
  const v = sessionStorage.getItem(KEY)
  return (GUIDED_STEPS as readonly string[]).includes(v ?? '') ? (v as GuidedStep) : null
}

export function stopGuided(): void {
  sessionStorage.removeItem(KEY)
  sessionStorage.removeItem(OPENED_KEY)
}

/**
 * Надо ли экрану увести человека на свой guided-шаг.
 *
 * Спрашивают экраны («Практика» — про flashcards, «Учёба» — про reader), а
 * решает guided.ts: правило одно на все перехваты, иначе они разъедутся.
 *
 * ⚠️ Это ЧИСТЫЙ вопрос, отметку он не ставит. Отметку ставит markAutoOpened в
 * момент самой навигации — иначе в StrictMode (он включён) двойной прогон
 * эффекта съедал бы разрешение, первый заход отменялся своей же чисткой, а
 * второй уже не имел права уводить: сессия не начиналась бы вовсе.
 */
export function shouldAutoOpen(step: GuidedStep): boolean {
  return currentGuidedStep() === step && sessionStorage.getItem(OPENED_KEY) !== step
}

/** Отметить, что на этот шаг уже увели. Звать в момент навигации. */
export function markAutoOpened(step: GuidedStep): void {
  sessionStorage.setItem(OPENED_KEY, step)
}

/**
 * Что будет следующим шагом — БЕЗ изменения сессии.
 *
 * ⚠️ Чистая функция, и это принципиально. Раньше баннер звал nextGuidedStep()
 * прямо в инициализаторе useState, то есть сессия продвигалась САМИМ ФАКТОМ
 * отрисовки экрана результата. Последствия: человек, бросивший занятие, доходил
 * до конца любого раунда — и шаг молча уезжал на «чтение», после чего «Учёба»
 * один раз уводила его в читалку, о которой он не просил. Плюс в StrictMode
 * инициализатор вызывается дважды, и второй вызов видел уже сдвинутый шаг.
 * Это то же семейство, что и автоперехват входа: продукт вёл человека по
 * маршруту, от которого он отказался.
 */
export function peekNextStep(
  step: GuidedStep,
): { route: string; title: string; label: string } | null {
  if (currentGuidedStep() !== step) return null
  const next = GUIDED_STEPS[GUIDED_STEPS.indexOf(step) + 1]
  if (!next) return null
  return { route: ROUTES[next], title: TITLES[next], label: `Дальше: ${TITLES[next]} →` }
}

/**
 * Перейти к следующему шагу. Зовётся ПО НАЖАТИЮ на баннер — только так сессия
 * и должна двигаться. Последний шаг закрывает сессию.
 */
export function advanceGuided(step: GuidedStep): void {
  if (currentGuidedStep() !== step) return
  const next = GUIDED_STEPS[GUIDED_STEPS.indexOf(step) + 1]
  if (!next) {
    stopGuided()
    return
  }
  sessionStorage.setItem(KEY, next)
}
