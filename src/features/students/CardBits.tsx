// ============================================================================
// Мелкие части карточки ученика (макет t6): аватар, бейдж статуса,
// «в приложении» / «без приложения». Вид — общие Avatar и Badge (лист s3);
// здесь — что значат статусы ученика.
// ============================================================================
import { STATUS_LABEL, type CardStatus } from '../../domains/students'
import { Avatar as AvatarView } from '../../shared/ui/Avatar'
import { Badge, type BadgeTone } from '../../shared/ui/Badge'
import { IconArchive, IconPause, IconSmartphone, IconSpark, type IconLike } from '../../shared/ui/icons'

/**
 * Аватар ученика: в приложении — заливка, без приложения — пунктир (макет
 * t6-1). Маленький — в сетке недели расписания (Ф2.7), крупный — шапка карточки.
 */
export function Avatar({ name, inApp, large = false, small = false }: { name: string; inApp: boolean; large?: boolean; small?: boolean }) {
  return <AvatarView name={name} size={large ? 64 : small ? 28 : 40} cardOnly={!inApp} />
}

/** Статус — цвет + значок + слово (s3): пробный, занимается, пауза, архив. */
const BADGE: Record<CardStatus, { tone: BadgeTone; Icon?: IconLike; dot?: boolean }> = {
  trial: { tone: 'accent', Icon: IconSpark },
  active: { tone: 'success', dot: true },
  paused: { tone: 'neutral', Icon: IconPause },
  archived: { tone: 'outline', Icon: IconArchive },
}

export function StatusBadge({ status }: { status: CardStatus }) {
  const { tone, Icon, dot } = BADGE[status]
  return (
    <Badge tone={tone} Icon={Icon} dot={dot}>
      {STATUS_LABEL[status]}
    </Badge>
  )
}

/** «в приложении» / «без приложения» — бейджем в шапке карточки. */
export function AppBadge({ inApp }: { inApp: boolean }) {
  return (
    <Badge tone="neutral" Icon={inApp ? IconSmartphone : undefined}>
      {inApp ? 'в приложении' : 'без приложения'}
    </Badge>
  )
}
