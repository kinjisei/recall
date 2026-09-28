// Шапка телефона и планшета: логотип, EN/ES, меню профиля. На компьютере
// шапки нет — то же самое живёт в боковой панели (SideNav).
import { AppLink } from '../../shared/ui/AppLink'
import { BrandLogo } from '../../shared/ui/Brand'
import { AvatarMenu } from './AvatarMenu'
import { LangSwitch } from './LangSwitch'

export function TopBar() {
  return (
    // vt-topbar — шапка не участвует в переходе между экранами и стоит
    // неподвижно, пока содержимое под ней меняется (см. index.css)
    <header className="vt-topbar sticky top-0 z-20 border-b border-white/[0.06] bg-[rgba(22,24,38,.82)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-sm items-center justify-between px-4 py-3">
        {/* полный логотип из макета (слово на флеш-карточке) вместо знака+текста */}
        <AppLink to="/" className="flex min-h-[44px] items-center" aria-label="На главную">
          <BrandLogo width={96} />
        </AppLink>

        <div className="flex items-center gap-3">
          <LangSwitch />
          <AvatarMenu />
        </div>
      </div>
    </header>
  )
}
