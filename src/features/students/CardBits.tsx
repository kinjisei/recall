// ============================================================================
// Мелкие части карточки ученика (макет t6): аватар-инициалы, бейдж статуса,
// «в приложении» / «без приложения».
// ============================================================================
import { initials, STATUS_LABEL, type CardStatus } from '../../domains/students'
import { IconSmartphone } from '../../shared/ui/icons'

/** Аватар: у ученика в приложении — заливка, без приложения — пунктир (макет t6-1). */
export function Avatar({ name, inApp, large = false }: { name: string; inApp: boolean; large?: boolean }) {
  const size = large ? 'size-16 text-xl' : 'size-10 text-sm'
  const look = inApp
    ? 'bg-accent-soft text-accent-soft-fg'
    : 'border border-dashed border-tint/[0.28] text-fg-secondary'
  return (
    <span aria-hidden className={`flex flex-none items-center justify-center rounded-full font-bold ${size} ${look}`}>
      {initials(name)}
    </span>
  )
}

const BADGE: Record<CardStatus, string> = {
  trial: 'bg-accent-soft text-accent-soft-fg',
  active: 'bg-success-soft text-success-soft-fg',
  paused: 'bg-tint/[0.08] text-fg-secondary',
  archived: 'bg-tint/[0.08] text-fg-secondary',
}

export function StatusBadge({ status }: { status: CardStatus }) {
  return (
    <span className={`inline-flex flex-none items-center rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

/** «в приложении» / «без приложения» — бейджем в шапке карточки. */
export function AppBadge({ inApp }: { inApp: boolean }) {
  return (
    <span className="inline-flex flex-none items-center gap-1 rounded-full bg-tint/[0.06] px-2 py-0.5 text-xs font-semibold text-fg-secondary">
      {inApp && <IconSmartphone size={13} />}
      {inApp ? 'в приложении' : 'без приложения'}
    </span>
  )
}
