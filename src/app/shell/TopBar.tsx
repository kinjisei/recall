// Шапка телефона по листу s4 («Каркас · телефон»): стекло glass поверх
// содержимого (содержимое прокручивается под ней); слева — знак и EN/ES,
// справа — колокольчик (только когда есть уведомления; первым в группе —
// появившись, он не сдвигает остальное), подарок-рефералка (у репетитора,
// PLAN.md Ф2.3) и аватар — меню профиля. Высота 52 под строкой состояния;
// цвет строки состояния = цвет шапки (theme-color, shared/ui/theme).
// На компьютере шапки нет — то же самое живёт в боковой панели (SideNav).
import { AppLink } from '../../shared/ui/AppLink'
import { BrandMark } from '../../shared/ui/Brand'
import { NotificationBell } from '../../features/notifications'
import { GiftButton } from '../../features/referral'
import { AvatarMenu } from './AvatarMenu'
import { LangSwitch } from './LangSwitch'
import { useMyRole } from './useMyRole'

export function TopBar() {
  const teacher = useMyRole() === 'teacher'
  return (
    // vt-topbar — шапка не участвует в переходе между экранами и стоит
    // неподвижно, пока содержимое под ней меняется (см. index.css)
    <header className="vt-topbar sticky top-0 z-20 border-b border-line bg-glass pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-13 max-w-screen-sm items-center justify-between gap-2 px-3">
        <div className="flex items-center gap-2">
          {/* знак 32 в цели 44 (ux-audit-schedule, Ф2.7) */}
          <AppLink to="/" className="flex size-11 flex-none items-center justify-center" aria-label="На главную">
            <BrandMark size={32} />
          </AppLink>
          <LangSwitch />
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          {teacher && <GiftButton />}
          <AvatarMenu />
        </div>
      </div>
    </header>
  )
}
