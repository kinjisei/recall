// ============================================================================
// Баннер ведомой сессии: показывается в конце шага («Начать занятие» на
// Главной) и ведёт к следующему — колода → чтение → речь.
// Если сессия не идёт, компонент ничего не рисует.
// ============================================================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightIcon, ConfettiIcon } from '@phosphor-icons/react'
import { currentGuidedStep, nextGuidedStep, type GuidedStep } from '../lib/guided'

export function GuidedNext({ step }: { step: GuidedStep }) {
  const navigate = useNavigate()
  // считаем следующий шаг один раз при появлении баннера
  const [next] = useState(() => (currentGuidedStep() === step ? nextGuidedStep(step) : null))
  const [active] = useState(() => currentGuidedStep() === step || next !== null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(true)
  }, [])

  if (!active || !visible) return null

  // последний шаг: сессия уже закрыта в nextGuidedStep — поздравляем
  if (!next) {
    return (
      <div className="animate-fade-up flex items-center gap-3 rounded-2xl border border-[var(--night-accent-45)] bg-[rgba(145,132,217,.12)] px-4 py-3.5">
        <ConfettiIcon size={22} weight="fill" className="flex-none text-[var(--night-accent-100)]" />
        <p className="text-sm">
          Занятие завершено — все три шага пройдены. Отличная работа!
        </p>
      </div>
    )
  }

  return (
    <button
      onClick={() => navigate(next.route)}
      className="lift animate-fade-up flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--night-accent-45)] bg-[linear-gradient(135deg,rgba(145,132,217,.22),rgba(145,132,217,.10))] px-4 py-3.5 text-left"
    >
      <span className="flex flex-col">
        <span className="text-[11px] uppercase tracking-wider text-[var(--night-text-40)]">
          Занятие продолжается
        </span>
        <span className="text-[15px] font-medium">{next.label}</span>
      </span>
      <ArrowRightIcon size={20} className="flex-none text-[var(--night-accent-100)]" />
    </button>
  )
}
