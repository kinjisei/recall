// Шапка телефона и планшета: логотип, EN/ES, колокольчик (только когда есть
// уведомления), подарок-рефералка (у репетитора, PLAN.md Ф2.3), меню профиля.
// На компьютере шапки нет — то же самое живёт в боковой панели (SideNav).
import { AppLink } from '../../shared/ui/AppLink'
import { BrandLogo, BrandMark } from '../../shared/ui/Brand'
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
    <header className="vt-topbar sticky top-0 z-20 border-b border-tint/[0.06] bg-page/82 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-sm items-center justify-between gap-2 px-4 py-3">
        {/* полный логотип из макета (слово на флеш-карточке) вместо знака+текста.
            У репетитора справа на кнопку больше (подарок): на телефоне уже
            640 px — знак, иначе с колокольчиком шапка не влезала в 390 px.
            min-w-11: знак 30 px, а нажимать — 44 (ux-audit-schedule, Ф2.7) */}
        <AppLink to="/" className="flex min-h-11 min-w-11 flex-none items-center" aria-label="На главную">
          {teacher ? (
            <>
              <BrandMark size={30} className="sm:hidden" />
              <BrandLogo width={96} className="hidden sm:block" />
            </>
          ) : (
            <BrandLogo width={96} />
          )}
        </AppLink>

        <div className="flex items-center gap-3">
          <LangSwitch />
          <NotificationBell />
          {teacher && <GiftButton />}
          <AvatarMenu />
        </div>
      </div>
    </header>
  )
}
