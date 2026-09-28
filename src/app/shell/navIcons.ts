// Иконки вкладок по имени из конфига навигации (app/navigation.ts). Отдельно
// от конфига, чтобы правила меню проверялись чистым тестом без разметки.
// Пара: обычная и залитая (активная вкладка); где залитой нет — одна и та же.
import {
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
  IconTimer,
  type IconProps,
} from '../../components/icons'
import type { NavIconName } from '../navigation'

type IconCmp = (p: IconProps) => React.JSX.Element

export const NAV_ICONS: Record<NavIconName, { Icon: IconCmp; IconFill: IconCmp }> = {
  home: { Icon: IconHome, IconFill: IconHomeFill },
  study: { Icon: IconStudy, IconFill: IconStudyFill },
  practice: { Icon: IconPractice, IconFill: IconPracticeFill },
  dialog: { Icon: IconDialog, IconFill: IconDialogFill },
  // меню учителя — черновые иконки до Ф2.10 (календаря в наборе пока нет)
  schedule: { Icon: IconTimer, IconFill: IconTimer },
  students: { Icon: IconTeacher, IconFill: IconTeacher },
  tasks: { Icon: IconMaterials, IconFill: IconMaterials },
}
