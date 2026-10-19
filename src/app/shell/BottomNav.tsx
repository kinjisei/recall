// ============================================================================
// Панель вкладок телефона (лист s4, «Каркас · телефон»): стеклянная капсула
// glass-bar (рамка line, тень только в светлой) плавает над полосой «домой»;
// под ней — мягкое затухание содержимого. Активная вкладка — подложка
// accent-soft, залитая иконка и жирная подпись; подложка скользит к новой
// вкладке за 240 мс (ease-sheet), при «уменьшить движение» — встаёт на место.
// Счётчик — только у «Заданий» репетитора: работы на проверку. Набор вкладок
// и правило «какая активна» — общие с боковой панелью компьютера:
// app/navigation.ts (там же — почему вкладок четыре).
// ============================================================================
import { AppLink } from '../../shared/ui/AppLink'
import { useKeyboardInset } from '../../lib/useKeyboardInset'
import { CountBadge } from '../../shared/ui/CountBadge'
import { NAV_ICONS } from './navIcons'
import { useNavTabs } from './useNavTabs'

export function BottomNav() {
  const { tabs, activeIndex, badgeOf, onTabClick } = useNavTabs()
  // при открытой клавиатуре навигацию прячем: на телефонах фиксированная
  // капсула иначе «всплывает» над клавиатурой и мешает набору
  const kb = useKeyboardInset()
  if (kb > 0) return null

  return (
    <>
      {/* затухание содержимого под панелью: текст уходит под стекло не
          обрезом, а растворяется (s4) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(6rem+env(safe-area-inset-bottom))] bg-linear-to-t from-page via-page/70 to-transparent"
      />
      {/* vt-nav — навигация выпадает из перехода между экранами и остаётся на
          месте, пока экран под ней меняется (см. index.css) */}
      <nav
        aria-label="Разделы"
        className="vt-nav fixed inset-x-3 bottom-3 z-30 mx-auto mb-[env(safe-area-inset-bottom)] max-w-screen-sm rounded-full border border-line bg-glass-bar shadow-raised backdrop-blur-xl backdrop-saturate-150"
      >
        <div className="relative grid auto-cols-fr grid-flow-col gap-1 p-1.5">
          {/* Скользящая подложка активной вкладки: отдельный элемент едет на
              transform, без пересчёта раскладки. Вкладки одинаковой ширины,
              промежуток 4 px — сдвиг «ширина + промежуток» на индекс. */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 rounded-full bg-accent-soft transition-[transform,opacity] duration-(--dur-2) ease-sheet"
            style={{
              width: `calc((100% - 0.75rem - ${tabs.length - 1} * 0.25rem) / ${tabs.length})`,
              transform: `translateX(calc(${Math.max(activeIndex, 0)} * (100% + 0.25rem)))`,
              opacity: activeIndex < 0 ? 0 : 1,
            }}
          />
          {tabs.map((tab, i) => {
            const { to, label, icon } = tab
            const active = i === activeIndex
            const TabIcon = active ? NAV_ICONS[icon].IconFill : NAV_ICONS[icon].Icon
            const badge = badgeOf(tab)
            return (
              <AppLink
                key={to}
                to={to}
                aria-label={badge.label}
                // соседняя вкладка — проявление на месте, без сдвига (s4)
                direction="fade"
                onClick={() => onTabClick(to)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-13 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-xs transition-colors duration-(--dur-2) ${
                  active ? 'font-semibold text-accent-soft-fg' : 'font-medium text-fg-muted hover:text-fg-secondary'
                }`}
              >
                <span className="relative flex">
                  <TabIcon size={24} />
                  {/* «ждут проверки» на «Заданиях» учителя (макет t1) */}
                  <CountBadge n={badge.n} className="-right-3 -top-1.5" />
                </span>
                <span className="truncate">{label}</span>
              </AppLink>
            )
          })}
        </div>
      </nav>
    </>
  )
}
