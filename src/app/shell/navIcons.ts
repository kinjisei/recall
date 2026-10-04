// Иконки вкладок по имени из конфига навигации (app/navigation.ts). Отдельно
// от конфига, чтобы правила меню проверялись чистым тестом без разметки.
// Пара: обычная и залитая (активная вкладка); где залитой нет — одна и та же.
import {
  IconCalendar,
  IconDialog,
  IconDialogFill,
  IconHome,
  IconHomeFill,
  IconMaterials,
  IconPractice,
  IconPracticeFill,
  IconStudy,
  IconStudyFill,
  IconTeacher,
  type IconProps,
} from '../../shared/ui/icons'
import type { NavIconName } from '../navigation'

type IconCmp = (p: IconProps) => React.JSX.Element

export const NAV_ICONS: Record<NavIconName, { Icon: IconCmp; IconFill: IconCmp }> = {
  home: { Icon: IconHome, IconFill: IconHomeFill },
  study: { Icon: IconStudy, IconFill: IconStudyFill },
  practice: { Icon: IconPractice, IconFill: IconPracticeFill },
  dialog: { Icon: IconDialog, IconFill: IconDialogFill },
  // меню учителя до Ф2.10: календарь есть (Ф2.7), залитого календаря,
  // users и clipboard — нет (опись интерфейса §6.2)
  schedule: { Icon: IconCalendar, IconFill: IconCalendar },
  students: { Icon: IconTeacher, IconFill: IconTeacher },
  tasks: { Icon: IconMaterials, IconFill: IconMaterials },
}
