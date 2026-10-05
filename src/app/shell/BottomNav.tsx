// ============================================================================
// Нижняя навигация «Nocturne» (телефон и планшет): плавающая glass-капсула с
// постоянными вкладками. Активная — мягкая акцентная подсветка и залитая (fill)
// иконка. Набор вкладок и правило «какая активна» — общие с боковой панелью
// компьютера: app/navigation.ts (там же — почему вкладок четыре).
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
    // vt-nav — навигация выпадает из перехода между экранами и остаётся на
    // месте, пока экран под ней меняется (см. index.css)
    <nav className="vt-nav fixed inset-x-4 bottom-4 z-30 mx-auto max-w-screen-sm rounded-3xl border border-tint/10 bg-page/78 backdrop-blur-xl mb-[env(safe-area-inset-bottom)]">
      <div className="relative flex items-stretch justify-around px-1.5 py-1.5">
        {/* Скользящая подложка активной вкладки. Раньше подсветка была фоном
            самой ссылки и просто перепрыгивала — глаз терял, откуда и куда он
            перешёл. Отдельный элемент едет на transform, то есть без пересчёта
            раскладки. Вкладки одинаковой ширины (flex-1), поэтому позиция —
            это просто «сдвинуть на свою ширину столько раз, каков индекс». */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 rounded-2xl bg-accent/16 transition-[transform,opacity] duration-300 [transition-timing-function:cubic-bezier(.22,1,.36,1)]"
          style={{
            width: `calc((100% - 0.75rem) / ${tabs.length})`,
            transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
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
              // экран едет в ту сторону, в какую человек двигается по вкладкам:
              // вправо по ряду — контент приезжает справа, и наоборот
              direction={activeIndex >= 0 && i < activeIndex ? 'out' : 'in'}
              onClick={() => onTabClick(to)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-caption font-medium transition-colors duration-300 [transition-timing-function:cubic-bezier(.22,1,.36,1)] ${
                active
                  ? 'text-accent-soft-fg'
                  : 'text-fg-muted hover:text-fg-secondary'
              }`}
            >
              <span className="relative">
                <TabIcon
                  size={22}
                  className={`transition-transform duration-300 [transition-timing-function:cubic-bezier(.22,1,.36,1)] ${
                    active ? '-translate-y-0.5' : ''
                  }`}
                />
                {/* «ждут проверки» на «Заданиях» учителя (макет t1) */}
                <CountBadge n={badge.n} className="-right-3 -top-2" />
              </span>
              <span>{label}</span>
            </AppLink>
          )
        })}
      </div>
    </nav>
  )
}
