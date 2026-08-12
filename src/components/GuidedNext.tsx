// ============================================================================
// Баннер ведомой сессии: показывается в конце шага («Начать занятие» на
// Главной) и ведёт к следующему — колода → чтение → речь.
// Если сессия не идёт, компонент ничего не рисует.
//
// ⚠️ Сессия двигается ТОЛЬКО по нажатию (advanceGuided в обработчике). Раньше
// шаг переключался прямо в инициализаторе useState, то есть самим фактом
// отрисовки: человек, бросивший занятие, доходил до конца любого раунда — и
// сессия молча уезжала на следующий шаг, после чего «Учёба» уводила его в
// читалку, о которой он не просил. Плюс StrictMode вызывает инициализатор
// дважды, и второй вызов видел уже сдвинутый шаг.
// ============================================================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowRight, IconSparkle } from './icons'
import {
  advanceGuided,
  currentGuidedStep,
  peekNextStep,
  stopGuided,
  type GuidedStep,
} from '../lib/guided'

export function GuidedNext({ step }: { step: GuidedStep }) {
  const navigate = useNavigate()
  // Снимок на момент появления баннера — чистый, сессию не трогает.
  const [onThisStep] = useState(() => currentGuidedStep() === step)
  const [next] = useState(() => peekNextStep(step))

  // Последний шаг: сессию закрываем здесь — это конец маршрута, а не движение
  // по нему, поэтому закрывать на появлении баннера честно.
  useEffect(() => {
    if (onThisStep && !next) stopGuided()
  }, [onThisStep, next])

  const [visible, setVisible] = useState(false)
  useEffect(() => {
    setVisible(true)
  }, [])

  if (!onThisStep || !visible) return null

  if (!next) {
    return (
      <div className="animate-fade-up flex items-center gap-3 rounded-2xl border border-[var(--night-accent-45)] bg-[rgba(145,132,217,.12)] px-4 py-3.5">
        <IconSparkle size={22} className="flex-none text-[var(--night-accent-100)]" />
        <p className="text-sm">Занятие завершено — все три шага пройдены. Отличная работа!</p>
      </div>
    )
  }

  return (
    <button
      onClick={() => {
        advanceGuided(step)
        navigate(next.route)
      }}
      className="lift animate-fade-up flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--night-accent-45)] bg-[linear-gradient(135deg,rgba(145,132,217,.22),rgba(145,132,217,.10))] px-4 py-3.5 text-left"
    >
      <span className="flex flex-col">
        <span className="text-[11px] uppercase tracking-wider text-[var(--night-text-40)]">
          Занятие продолжается
        </span>
        <span className="text-[15px] font-medium">{next.label}</span>
      </span>
      <IconArrowRight size={20} className="flex-none text-[var(--night-accent-100)]" />
    </button>
  )
}
