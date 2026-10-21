// Как служебная строка ответа AI выглядит (replyMarkers): значок и цвет —
// лента «Диалога» и карточка «Диалог» на «Моей учёбе» (d12).
import { IconCheck, IconMaterials, IconPencil, type IconLike } from '../../shared/ui/icons'
import type { MarkerKind } from './replyMarkers'

export const MARKER_LOOK: Record<MarkerKind, { Icon: IconLike; cls: string }> = {
  fix: { Icon: IconPencil, cls: 'text-accent-strong' },
  ok: { Icon: IconCheck, cls: 'text-success-strong' },
  topic: { Icon: IconMaterials, cls: 'font-medium text-accent-strong' },
}
