// ============================================================================
// Ряд вкладок студии: «Расписание» (ведёт на /schedule, Ф2.7) · «Ученики» ·
// «Материалы» · «Письменные работы» · «Методичка». До меню учителя (Ф2.10)
// это единственный вход в расписание; с Ф2.10 расписание — первая вкладка
// меню, и этот ряд пересоберётся по «Заданиям».
//
// Перенос строки, а не горизонтальная прокрутка. Замер ревью 1В: ряду из
// четырёх вкладок нужно 415px, а на iPhone 12 доступно 348 — четвёртая
// («Методичка») уезжала за край, прокрутки у контейнера не было, и добраться
// до неё можно было только сдвигая вбок всю страницу. Скрытая прокрутка лечила
// бы обрезку, но не саму проблему: человек не знает, что там есть ещё вкладка.
// ============================================================================
import { AppLink } from '../../shared/ui/AppLink'
import { IconCalendar } from '../../shared/ui/icons'

export type TeacherTab = 'students' | 'materials' | 'writing' | 'guide'

const TABS: [TeacherTab, string][] = [
  ['students', 'Ученики'],
  ['materials', 'Материалы'],
  // «Письмо» читалось как «сообщение ученику», хотя это задания-эссе с
  // проверкой по критериям IELTS — самый сильный довод студии прятался за
  // названием (находка ревью 1В). У ученика раздел называется так же.
  ['writing', 'Письменные работы'],
  ['guide', 'Методичка'],
]

const base = 'flex min-h-11 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold'

function Count({ n }: { n: number }) {
  return n > 0 ? <span className="ml-0.5 rounded-full bg-warning px-1.5 py-0.5 text-xs font-bold text-warning-fg">{n}</span> : null
}

export function StudioTabs({
  tab,
  onTab,
  pendingWorks,
  pendingWriting,
}: {
  tab: TeacherTab
  onTab: (t: TeacherTab) => void
  /** «Ждут проверки» на вкладках. */
  pendingWorks: number
  pendingWriting: number
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <AppLink to="/schedule" className={`${base} bg-tint/[0.07] text-fg-secondary`}>
        <IconCalendar size={16} aria-hidden /> Расписание
      </AppLink>
      {TABS.map(([id, label]) => (
        <button
          key={id}
          onClick={() => onTab(id)}
          className={`${base} ${tab === id ? 'bg-accent-soft text-accent-soft-fg' : 'bg-tint/[0.07] text-fg-secondary'}`}
        >
          {label}
          {id === 'materials' && <Count n={pendingWorks} />}
          {id === 'writing' && <Count n={pendingWriting} />}
        </button>
      ))}
    </div>
  )
}
