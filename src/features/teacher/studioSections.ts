// ============================================================================
// Разделы карточки ученика — плитки 2×3 под домашкой (макет t6-2; PLAN.md
// Ф2.11б-2, решение владельца 10.10.2026: набор и порядок — как в макете,
// «План дня» — внутри «Программы»). Нажатие — экран раздела с «назад».
//
// ⚠️ Открытый раздел живёт в АДРЕСЕ (?sec=), как на остальных экранах: в PWA
// свайп-назад — единственный способ вернуться, и без этого он выбрасывал бы
// из карточки целиком вместо возврата к ней. Старые ссылки ?sec=plan (план
// дня был отдельным разделом) открывают «Программу».
// ============================================================================
import { useUrlState } from '../../shared/lib/useUrlState'
import { IconBars, IconDocument, IconFlag, IconMail, IconPulse, IconText, type IconLike } from '../../shared/ui/icons'

export const STUDIO_SECTIONS = [
  { id: 'diag', title: 'Диагностика', Icon: IconPulse },
  { id: 'program', title: 'Программа', Icon: IconDocument },
  { id: 'words', title: 'Слова', Icon: IconText },
  { id: 'placement', title: 'Тест уровня', Icon: IconBars },
  { id: 'quests', title: 'Квесты', Icon: IconFlag },
  { id: 'report', title: 'Отчёт родителям', Icon: IconMail },
] as const satisfies readonly { id: string; title: string; Icon: IconLike }[]

export type StudioSection = (typeof STUDIO_SECTIONS)[number]['id']

const LEGACY: Record<string, StudioSection> = { plan: 'program' }

const toSection = (raw: string | null): StudioSection | null =>
  raw === null ? null : (LEGACY[raw] ?? (STUDIO_SECTIONS.find((s) => s.id === raw)?.id as StudioSection | undefined) ?? null)

/** Открытый раздел карточки и переход в него (null — назад к карточке). */
export function useStudioSection(): [StudioSection | null, (next: StudioSection | null) => void] {
  const [raw, setRaw] = useUrlState('sec', (v) => toSection(v) !== null)
  return [toSection(raw), setRaw]
}
