// ============================================================================
// Меню компьютера слева (журнал п.46, п.55; макеты s4-2, d0, d4-v2; архитектура
// §16). Два вида:
//   • 240 с подписями (окно от 1280): знак и слово Recall, вкладки, внизу
//     «Уведомления» (только когда они есть, Ф1.5), «Пригласить коллегу» (у
//     репетитора, Ф2.3), карточка профиля и EN/ES; рядом со знаком — «свернуть»;
//   • рельс 72 из иконок (720–1279, или 240 свёрнуто руками): подпись — при
//     наведении, внизу те же кнопки иконками.
// Вкладки — те же, что у нижней панели телефона (app/navigation.ts), с той же
// скользящей подложкой (240 мс, ease-sheet — лист s4), только по вертикали;
// активная — залитая иконка и жирная подпись. Шапки при меню слева нет.
//
// ⚠️ Ширины w-60 (240) и w-18 (72) — те же, что MENU_PX / RAIL_PX
// (shared/ui/breakpoints) и отступ области в Layout.tsx: меняешь здесь —
// меняй там.
// ============================================================================
import { AppLink } from '../../shared/ui/AppLink'
import { BrandMark } from '../../shared/ui/Brand'
import { NotificationBell } from '../../features/notifications'
import { GiftButton } from '../../features/referral'
import { CountBadge } from '../../shared/ui/CountBadge'
import { HoverTip } from '../../shared/ui/HoverTip'
import { IconChevronLeft, IconChevronRight } from '../../shared/ui/icons'
import { AvatarMenu } from './AvatarMenu'
import { LangSwitch } from './LangSwitch'
import { NAV_ICONS } from './navIcons'
import { useMyRole } from './useMyRole'
import { useNavTabs } from './useNavTabs'

export function SideNav({ rail, collapsible, onToggle }: { rail: boolean; collapsible: boolean; onToggle: () => void }) {
  const { tabs, activeIndex, badgeOf, onTabClick } = useNavTabs()
  const teacher = useMyRole() === 'teacher'
  const toggle = collapsible && (
    <button
      type="button"
      onClick={onToggle}
      aria-label={rail ? 'Развернуть меню' : 'Свернуть меню'}
      className={`group relative flex size-11 flex-none items-center justify-center rounded-control-sm text-fg-faint transition-colors hover:bg-tint/[0.06] hover:text-fg-secondary ${rail ? 'mt-1' : '-mr-1'}`}
    >
      {rail ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
      {rail && <HoverTip label="Развернуть меню" />}
    </button>
  )

  return (
    // vt-nav — как у нижней панели: меню выпадает из перехода между экранами
    // и стоит на месте, пока экран рядом меняется (см. index.css)
    <nav
      aria-label="Разделы"
      data-menu={rail ? 'rail' : 'full'}
      className={`vt-nav fixed inset-y-0 left-0 z-30 flex flex-col border-r border-line bg-surface pb-4 pt-5 ${
        rail ? 'w-18 items-center' : 'w-60 px-3'
      }`}
    >
      <div className={`flex ${rail ? 'mb-6 flex-col items-center' : 'mb-4 items-center justify-between'}`}>
        <AppLink
          to="/"
          aria-label="На главную"
          className={`flex min-h-11 items-center gap-2.5 rounded-control-sm ${rail ? 'min-w-11 justify-center' : 'px-2'}`}
        >
          <BrandMark size={30} />
          {!rail && <span className="text-xl font-semibold tracking-[-0.01em] text-fg">Recall</span>}
        </AppLink>
        {toggle}
      </div>

      <div className={`relative flex flex-col ${rail ? 'items-center' : 'gap-1'}`}>
        {/* Подложка активной вкладки едет по transform, как у нижней панели:
            пункты одной высоты (h-11 / size-12), поэтому сдвиг — «шаг × индекс»;
            в меню 240 шаг — высота и промежуток 4 px (макет d4-v2). */}
        <span
          aria-hidden
          className={`pointer-events-none absolute top-0 rounded-control bg-accent-soft transition-[transform,opacity] duration-(--dur-2) ease-sheet ${
            rail ? 'size-12' : 'inset-x-0 h-11'
          }`}
          style={{
            transform: rail
              ? `translateY(${Math.max(activeIndex, 0) * 100}%)`
              : `translateY(calc(${Math.max(activeIndex, 0)} * (100% + 0.25rem)))`,
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
              // в рельсе подпись видна только при наведении и скрыта от
              // скринридера — имя вкладки даёт aria-label
              aria-label={badge.label ?? (rail ? label : undefined)}
              // соседняя вкладка — проявление на месте, без сдвига (s4)
              direction="fade"
              onClick={() => onTabClick(to)}
              aria-current={active ? 'page' : undefined}
              className={`group relative flex items-center rounded-control transition-colors duration-300 ${
                rail
                  ? `size-12 justify-center ${active ? 'text-accent-soft-fg' : 'text-fg-muted hover:text-fg-secondary'}`
                  : `h-11 gap-3 px-3 text-body ${active ? 'font-semibold text-accent-soft-fg' : 'font-medium text-fg-secondary hover:text-fg'}`
              }`}
            >
              <span className="relative flex">
                <TabIcon size={22} />
                {/* «ждут проверки» на «Заданиях» учителя: в рельсе — на иконке */}
                {rail && <CountBadge n={badge.n} className="-right-2.5 -top-2" />}
              </span>
              {rail ? (
                <HoverTip label={label} />
              ) : (
                <>
                  <span className="flex-1">{label}</span>
                  <CountBadge n={badge.n} inline />
                </>
              )}
            </AppLink>
          )
        })}
      </div>

      <div className={`mt-auto flex flex-col gap-1 ${rail ? 'items-center' : ''}`}>
        <NotificationBell variant={rail ? 'rail' : 'row'} />
        {/* подарок-рефералка (Ф2.3) — только у репетитора */}
        {teacher && <GiftButton variant={rail ? 'rail' : 'row'} />}
        <div className={rail ? 'mt-1' : 'mt-2'}>
          <AvatarMenu variant={rail ? 'rail' : 'row'} />
        </div>
        {/* в меню 240 — компактный сегмент слева, как в макете, а не на всю ширину */}
        <div className={`mt-2 ${rail ? '' : 'self-start'}`}>
          <LangSwitch vertical={rail} />
        </div>
      </div>
    </nav>
  )
}
