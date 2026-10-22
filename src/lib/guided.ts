// ============================================================================
// Описание: src/features/dashboard/CLAUDE.md
// «Начать занятие» — ведомая сессия по плану дня (журнал п.76 (10)): шаги —
// пункты плана, которые сегодня ещё не сделаны (lib/dailyPlanCore
// `sessionSteps`), подпись под кнопкой — из них же. Раньше занятие было
// всегда «колода → чтение → речь», и план, который настроил учитель, на него
// не влиял.
// Намеренно без state-менеджера: шаги и текущий шаг лежат в sessionStorage.
// Шаг сделан — когда записалась активность его типа (logActivity → тот же
// признак, что отмечает пункт плана «Сделано» на Главной) или экран сам сказал
// «конец» (`markGuidedDone`: прочитан текст, раунд повторения или речи
// окончен — даже если повторять было нечего). Тогда внизу экрана плашка
// «Дальше: …» (features/dashboard GuidedBar). Закрыл вкладку — сессия
// просто забылась.
// ============================================================================

import { buildTodayPlan, todayWeekday, type TodayPlanItem } from './dailyPlanCore'
import type { ActivityType, AppLang } from '../types'

const KEY = 'recall.guided'
const STEPS_KEY = 'recall.guided.steps'
/** Шаг, работа которого уже сделана: плашка «Дальше» показана. */
const DONE_KEY = 'recall.guided.done'

/**
 * Шаг, на который человека УЖЕ увели автоматически.
 *
 * ⚠️ Без этой отметки сессия превращалась в ловушку. Шаг переключается только
 * по нажатию «Дальше» (advanceGuided), то есть когда работа сделана. Бросил
 * на середине — шаг навсегда остался прежним, и КАЖДЫЙ вход в «Практику»
 * снова кидал в повторение; нижней навигации в раунде нет, выйти можно только
 * кареткой. Человек, решивший заняться другим, упирался в это бесконечно
 * (жалоба владельца: «приходилось выходить, чтобы выбрать что-то другое»).
 *
 * Теперь автоперехват срабатывает РОВНО ОДИН РАЗ на шаг — сразу после
 * «Начать занятие». Сама сессия живёт дальше: «Дальше» работает как раньше.
 */
const OPENED_KEY = 'recall.guided.opened'

/** Событие окна: сессия изменилась — плашке «Дальше» перечитать состояние. */
export const GUIDED_EVENT = 'recall:guided'

/** Шаг сессии — ключ пункта плана: words, reader, grammar, pronunciation, conversation, assignment, quest. */
export type GuidedStep = string

interface Step {
  key: GuidedStep
  to: string
  types: ActivityType[]
}

/** «Дальше: грамматика» — как шаг называется в плашке (стрелка — значком). */
const TITLES: Record<string, string> = {
  words: 'повторение слов',
  reader: 'чтение',
  grammar: 'грамматика',
  pronunciation: 'речь',
  conversation: 'диалог',
  assignment: 'задание',
  quest: 'квест',
}

/** Сессия, начатая до занятия по плану (вкладка открыта с прошлой версии): прежние три шага. */
const LEGACY: Step[] = [
  { key: 'words', to: '/practice', types: ['flashcards', 'practice'] },
  { key: 'reader', to: '/study?view=reader', types: ['reader'] },
  { key: 'pronunciation', to: '/pronunciation', types: ['pronunciation'] },
]

const changed = () => {
  try {
    window.dispatchEvent(new Event(GUIDED_EVENT))
  } catch {
    /* вне браузера */
  }
}

function steps(): Step[] {
  try {
    const raw = sessionStorage.getItem(STEPS_KEY)
    if (raw) return JSON.parse(raw) as Step[]
  } catch {
    /* битая запись — как у прежней версии */
  }
  return LEGACY
}

/** План на сегодня без настроек учителя — когда экран не знает плана (онбординг). */
function defaultPlan(): TodayPlanItem[] {
  return buildTodayPlan(null, { pendingAssignments: 0, activeQuests: 0, weekday: todayWeekday() })
}

/** Начать сессию с первого шага; вернуть, куда вести. */
export function startGuided(plan: TodayPlanItem[]): string {
  const list: Step[] = plan.map((p) => ({ key: p.key, to: p.to, types: p.types }))
  sessionStorage.setItem(STEPS_KEY, JSON.stringify(list))
  sessionStorage.setItem(KEY, list[0]!.key)
  // новая сессия — право на автопереход возвращается, сделанного нет
  sessionStorage.removeItem(OPENED_KEY)
  sessionStorage.removeItem(DONE_KEY)
  changed()
  return list[0]!.to
}

/**
 * Куда вести сессию НА САМОМ ДЕЛЕ — решаем до перехода.
 *
 * Раньше «Начать занятие» всегда уводило на хаб «Практика», и только там,
 * двумя запросами, выяснялось, что слов у человека нет и шаг надо пропустить.
 * Замер ревью 1А: ~5 секунд человек смотрел на меню из двенадцати плиток, а
 * потом экран менялся сам. Теперь проверка идёт ДО навигации: повторять
 * нечего (слов нет или ни одно не подошло) — шаг слов пропускаем. Сбой
 * запроса не блокирует — ведём сессию как есть.
 *
 * @param plan шаги — `sessionSteps` плана дня; не знаем плана — план без
 *             настроек учителя
 */
export async function startGuidedRoute(lang: AppLang, plan?: TodayPlanItem[]): Promise<string> {
  let list = plan?.length ? plan : defaultPlan()
  if (list[0]?.key === 'words' && list.length > 1) {
    try {
      // счётчик — лениво: плашку «Дальше» рисует каркас, а запросы к колоде ему ни к чему
      const { countDueCards } = await import('./fsrs')
      if ((await countDueCards(lang)) === 0) list = list.slice(1)
    } catch {
      /* не смогли проверить — обычный порядок шагов */
    }
  }
  return startGuided(list)
}

/**
 * Guided-вход в «Практику» на шаге слов, а повторять нечего (сессию начали по
 * старому плану): шаг пропускаем и ведём к следующему. Возвращает его маршрут
 * или null — идём в повторение (или сессия на этом и кончается).
 */
export async function skipReviewIfNoWords(lang: AppLang): Promise<string | null> {
  if (currentGuidedStep() !== 'words') return null
  try {
    const { countDueCards } = await import('./fsrs')
    if ((await countDueCards(lang)) > 0) return null
  } catch {
    return null // не смогли проверить — ведём сессию как обычно
  }
  const next = peekNextStep('words')
  if (!next) return null
  advanceGuided('words')
  return next.route
}

/** Идёт ли сессия и на каком шаге. */
export function currentGuidedStep(): GuidedStep | null {
  const v = sessionStorage.getItem(KEY)
  if (v === 'flashcards') return 'words' // шаг прежней версии
  return v && steps().some((s) => s.key === v) ? v : null
}

export function stopGuided(): void {
  sessionStorage.removeItem(KEY)
  sessionStorage.removeItem(STEPS_KEY)
  sessionStorage.removeItem(OPENED_KEY)
  sessionStorage.removeItem(DONE_KEY)
  changed()
}

/**
 * Надо ли экрану увести человека на свой guided-шаг.
 *
 * Спрашивают экраны («Практика» — про words, «Учёба» — про reader), а
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
 * Работа шага сделана — экран сам знает свой конец: прочитан текст, раунд
 * повторения окончен (даже пустой — «повторять нечего»), раунд речи пройден.
 * Сессию не двигает: двигает только нажатие «Дальше».
 */
export function markGuidedDone(step: GuidedStep): void {
  if (currentGuidedStep() !== step || sessionStorage.getItem(DONE_KEY) === step) return
  sessionStorage.setItem(DONE_KEY, step)
  changed()
}

/**
 * Эти типы пишутся на каждой карточке, фразе и слове, а не в конце: «Дальше»
 * посреди раунда только мешало бы. Конец таких шагов говорит сам экран
 * (`markGuidedDone`: итог повторения, текст открыт, раунд речи пройден).
 */
const PER_ITEM: ReadonlySet<ActivityType> = new Set(['flashcards', 'pronunciation', 'reader'])

/**
 * Записалась активность (logActivity): её тип закрывает текущий шаг — шаг
 * сделан. Тот же признак отмечает пункт плана «Сделано» на Главной
 * (грамматика, игры, диалог, задание, квест).
 */
export function noteGuidedActivity(type: ActivityType): void {
  if (PER_ITEM.has(type)) return
  try {
    const step = currentGuidedStep()
    if (step && steps().find((s) => s.key === step)?.types.includes(type)) markGuidedDone(step)
  } catch {
    /* sessionStorage недоступен — сессии и нет */
  }
}

/** Сделана ли работа текущего шага (плашке «Дальше» — показаться). */
export function isGuidedDone(): boolean {
  const step = currentGuidedStep()
  return step !== null && sessionStorage.getItem(DONE_KEY) === step
}

/** «Шаг 2 из 3» для плашки. */
export function guidedPosition(): { index: number; total: number } | null {
  const step = currentGuidedStep()
  if (!step) return null
  const list = steps()
  return { index: list.findIndex((s) => s.key === step) + 1, total: list.length }
}

/**
 * Что будет следующим шагом — БЕЗ изменения сессии.
 *
 * ⚠️ Чистая функция, и это принципиально. Раньше баннер звал nextGuidedStep()
 * прямо в инициализаторе useState, то есть сессия продвигалась САМИМ ФАКТОМ
 * отрисовки экрана результата. Последствия: человек, бросивший занятие, доходил
 * до конца любого раунда — и шаг молча уезжал дальше, после чего «Учёба»
 * один раз уводила его в читалку, о которой он не просил.
 */
export function peekNextStep(step: GuidedStep): { route: string; title: string; label: string } | null {
  if (currentGuidedStep() !== step) return null
  const list = steps()
  const next = list[list.findIndex((s) => s.key === step) + 1]
  if (!next) return null
  const title = TITLES[next.key] ?? next.key
  return { route: next.to, title, label: `Дальше: ${title}` }
}

/**
 * Перейти к следующему шагу. Зовётся ПО НАЖАТИЮ «Дальше» — только так сессия
 * и должна двигаться. Последний шаг закрывает сессию.
 */
export function advanceGuided(step: GuidedStep): void {
  if (currentGuidedStep() !== step) return
  const list = steps()
  const next = list[list.findIndex((s) => s.key === step) + 1]
  if (!next) {
    stopGuided()
    return
  }
  sessionStorage.setItem(KEY, next.key)
  sessionStorage.removeItem(DONE_KEY)
  changed()
}
