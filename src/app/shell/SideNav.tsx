// ============================================================================
// Боковое меню компьютера (от 1024 px, журнал п.45–46; архитектура §16).
//
// Вкладки — те же, что у нижней панели телефона (app/navigation.ts), с той же
// скользящей подложкой, только по вертикали. Шапки на компьютере нет: логотип
// наверху панели, язык, меню профиля и колокольчик уведомлений (только когда
// они есть, Ф1.5) — внизу; подарок-рефералка встанет туда же в Ф2.10.
//
// Окончательный вид — в редизайне (Ф5); здесь только цвета-токены Nocturne.
// ⚠️ Ширина w-60 (15rem) — та же, что отступ колонки и DESKTOP_INSETS в
// Layout.tsx: меняешь здесь — меняй там.
// ============================================================================
import { AppLink } from '../../shared/ui/AppLink'
import { BrandLogo } from '../../shared/ui/Brand'
import { NotificationBell } from '../../features/notifications'
import { AvatarMenu } from './AvatarMenu'
import { LangSwitch } from './LangSwitch'
import { NAV_ICONS } from './navIcons'
import { useNavTabs } from './useNavTabs'

export function SideNav() {
  const { tabs, activeIndex, onTabClick } = useNavTabs()

  return (
    // vt-nav — как у нижней панели: меню выпадает из перехода между экранами
    // и стоит на месте, пока экран рядом меняется (см. index.css)
    <nav
      aria-label="Разделы"
      className="vt-nav fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-line bg-page px-3 pb-4 pt-5"
    >
      <AppLink to="/" className="mb-6 flex min-h-11 items-center px-3" aria-label="На главную">
        <BrandLogo width={96} />
      </AppLink>

      <div className="relative flex flex-col">
        {/* Подложка активной вкладки едет по transform, как у нижней панели:
            пункты одной высоты (h-11), поэтому сдвиг — «высота × индекс». */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-11 rounded-2xl bg-accent-soft transition-[transform,opacity] duration-300 [transition-timing-function:cubic-bezier(.22,1,.36,1)]"
          style={{
            transform: `translateY(${Math.max(activeIndex, 0) * 100}%)`,
            opacity: activeIndex < 0 ? 0 : 1,
          }}
        />
        {tabs.map(({ to, label, icon }, i) => {
          const active = i === activeIndex
          const TabIcon = active ? NAV_ICONS[icon].IconFill : NAV_ICONS[icon].Icon
          return (
            <AppLink
              key={to}
              to={to}
              // вниз по списку — экран приезжает справа, вверх — слева
              direction={activeIndex >= 0 && i < activeIndex ? 'out' : 'in'}
              onClick={() => onTabClick(to)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors duration-300 ${
                active
                  ? 'text-accent-soft-fg'
                  : 'text-fg-muted hover:text-fg-secondary'
              }`}
            >
              <TabIcon size={22} />
              <span>{label}</span>
            </AppLink>
          )
        })}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-4">
        <div className="flex items-center gap-2">
          <AvatarMenu opensUp />
          <NotificationBell />
        </div>
        <LangSwitch />
      </div>
    </nav>
  )
}
