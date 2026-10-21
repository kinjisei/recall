// ============================================================================
// Плашка ведомого занятия «Дальше: грамматика →» (журнал п.76 (10)). Одна на
// все шаги: её рисует каркас под содержимым экрана (app/shell Layout), когда
// работа текущего шага сделана (lib/guided: активность его типа записалась
// или экран сам сказал «конец»). Раньше у трёх экранов (повторение, чтение,
// речь) была своя копия, а шагам плана дня — грамматике, диалогу, заданию,
// квесту — показаться было негде. В «Диалоге» лента стоит в окне, а поле
// ввода закреплено, — там плашка встаёт под полем (`inline`), а каркасная
// молчит.
//
// ⚠️ Сессия двигается ТОЛЬКО по нажатию (advanceGuided в обработчике). Раньше
// шаг переключался прямо в инициализаторе useState, то есть самим фактом
// отрисовки: человек, бросивший занятие, доходил до конца любого раунда — и
// сессия молча уезжала на следующий шаг.
// ============================================================================
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GUIDED_EVENT, advanceGuided, currentGuidedStep, guidedPosition, isGuidedDone, markGuidedDone, peekNextStep, stopGuided } from '../../lib/guided'
import { IconArrowRight, IconSparkle } from '../../shared/ui/icons'

const subscribe = (cb: () => void) => {
  window.addEventListener(GUIDED_EVENT, cb)
  return () => window.removeEventListener(GUIDED_EVENT, cb)
}
/** Снимок сессии строкой: шаг и сделан ли он (getSnapshot обязан быть стабильным). */
const snapshot = () => {
  try {
    return `${currentGuidedStep() ?? ''}|${isGuidedDone() ? 1 : 0}`
  } catch {
    return '|0'
  }
}

export function GuidedBar({ inline = false }: { inline?: boolean }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const state = useSyncExternalStore(subscribe, snapshot, () => '|0')
  const [step, doneFlag] = state.split('|')
  const done = !!step && doneFlag === '1'
  const next = done ? peekNextStep(step!) : null
  const pos = done ? guidedPosition() : null
  // в «Диалоге» плашка — под полем ввода (inline); каркасная там молчит и сессию
  // не трогает: иначе она закрывала занятие раньше, чем появлялась плашка под полем
  const mine = inline || !pathname.startsWith('/conversation')
  // последний шаг сделан — сессия закрыта, а «Занятие завершено» остаётся,
  // пока человек не уйдёт с этого экрана (запомнили адрес при отрисовке)
  const finished = mine && done && !next
  const [finishedOn, setFinishedOn] = useState<string | null>(null)
  if (finished && finishedOn !== pathname) setFinishedOn(pathname)
  // ушёл с экрана — «завершено» больше не показываем (и при возврате на него)
  if (!finished && finishedOn !== null && finishedOn !== pathname) setFinishedOn(null)
  useEffect(() => {
    if (finished) stopGuided()
  }, [finished])

  if (!mine) return null

  if (finishedOn === pathname && !step) {
    return (
      <div role="status" className="animate-fade-up mt-4 flex items-center gap-3 rounded-row bg-accent-soft px-4 py-3.5 text-accent-soft-fg" data-guided-bar="done">
        <IconSparkle size={22} aria-hidden className="flex-none" />
        <p className="text-sm">Занятие завершено — все шаги плана пройдены. Отличная работа!</p>
      </div>
    )
  }
  if (!done || !next) return null

  return (
    <button
      type="button"
      onClick={() => {
        advanceGuided(step!)
        navigate(next.route)
      }}
      data-guided-bar="next"
      className={`lift animate-fade-up flex w-full items-center justify-between gap-3 rounded-row border border-accent-line bg-linear-135 from-accent/22 to-accent/10 px-4 py-3.5 text-left ${inline ? 'mt-2' : 'mt-4'}`}
    >
      <span className="flex flex-col">
        <span className="text-caption uppercase tracking-wider text-fg-muted">
          Занятие продолжается{pos ? ` · шаг ${pos.index} из ${pos.total} готов` : ''}
        </span>
        <span className="text-body font-medium">{next.label}</span>
      </span>
      <IconArrowRight size={20} aria-hidden className="flex-none text-accent-soft-fg" />
    </button>
  )
}

/**
 * Экран дошёл до своего конца — шаг занятия сделан (повторение окончено, даже
 * если повторять было нечего; текст открыт; раунд речи пройден). Ничего не
 * рисует: «Дальше» покажет плашка каркаса. Сессию не двигает.
 */
export function GuidedDone({ step }: { step: string }) {
  useEffect(() => {
    markGuidedDone(step)
  }, [step])
  return null
}
