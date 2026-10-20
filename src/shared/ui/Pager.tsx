// ============================================================================
// Листалка «Работа 2 из 2 ‹ ›» (макет d7-2, d7-3 `.nav2`): где ты в очереди и
// две кнопки 44 — к предыдущему и следующему. Кнопки на поверхности с тонкой
// рамкой (`.ibs`); в макете 36 — у нас цель касания 44. Последний в очереди —
// «›» ведёт к первому: очередь проверки по кругу, «Дальше откроется» так же.
// ============================================================================
import { IconChevronLeft, IconChevronRight } from './icons'

const BTN =
  'flex size-11 flex-none items-center justify-center rounded-control-sm bg-surface text-fg inset-ring-1 inset-ring-line transition-colors active:bg-row-press disabled:text-fg-faint'

export function Pager({
  label,
  onPrev,
  onNext,
  prevLabel = 'Предыдущая',
  nextLabel = 'Следующая',
}: {
  /** «Работа 2 из 2». */
  label: string
  /** null — кнопка выключена (в очереди одна). */
  onPrev: (() => void) | null
  onNext: (() => void) | null
  prevLabel?: string
  nextLabel?: string
}) {
  return (
    <nav aria-label={label} className="flex items-center gap-1.5 text-sm text-fg-secondary tabular-nums">
      <span className="mr-1">{label}</span>
      <button type="button" className={BTN} onClick={onPrev ?? undefined} disabled={!onPrev} aria-label={prevLabel}>
        <IconChevronLeft size={18} aria-hidden />
      </button>
      <button type="button" className={BTN} onClick={onNext ?? undefined} disabled={!onNext} aria-label={nextLabel}>
        <IconChevronRight size={18} aria-hidden />
      </button>
    </nav>
  )
}
