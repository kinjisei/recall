// ============================================================================
// Общая рамка экранов в теме «Nocturne». Раскладка по ширине экрана
// (журнал п.45–46; архитектура §5, §16):
//   • телефон и планшет — шапка сверху (TopBar), плавающая нижняя навигация
//     (BottomNav);
//   • компьютер (от 1024 px) — меню слева (SideNav), шапки нет.
// Экран на любой ширине — колонка 640 px; на компьютере — по центру места
// рядом с меню. Общая раскладка из shared/ui («список + подробности»,
// «колонка чтения») просит ширину страницы, до 1100 px — shared/lib/screenWidth.
//
// Режим раунда (игра на весь экран) прячет навигацию на любой ширине —
// shared/lib/focusMode. Сколько места занимает каркас вокруг экрана, экраны
// с закреплёнными элементами узнают из shared/lib/shellInsets.
//
// Над стартовым экраном и студией — плашка «Тариф закончился — продлить»
// (PLAN.md Ф2.4; где — navigation.ts, что сказать — features/billing).
// ============================================================================
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AccessEndedBanner } from '../../features/billing'
import { FocusModeContext } from '../../shared/lib/focusMode'
import { PageWidthContext } from '../../shared/lib/screenWidth'
import { InShellContext, PHONE_INSETS, ShellInsetsContext, type ShellInsets } from '../../shared/lib/shellInsets'
import { useIsDesktop } from '../../shared/lib/useMediaQuery'
import { showsAccessBanner } from '../navigation'
import { BottomNav } from './BottomNav'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'
import { useMyRole } from './useMyRole'

/** Меню компьютера — 15rem (w-60 в SideNav, pl-60 ниже) слева; снизу ничего нет. */
const DESKTOP_INSETS: ShellInsets = { left: '15rem', bottom: '0px', bottomPx: 0 }
/** В раунде навигации нет ни снизу, ни слева. */
const FOCUS_INSETS: ShellInsets = { left: '0px', bottom: '0px', bottomPx: 0 }

export function Layout() {
  const [focus, setFocus] = useState(false)
  const [pageWidth, setPageWidth] = useState(false)
  const desktop = useIsDesktop()
  const withMenu = desktop && !focus
  const insets = focus ? FOCUS_INSETS : desktop ? DESKTOP_INSETS : PHONE_INSETS
  const role = useMyRole()
  const { pathname } = useLocation()
  const banner = !focus && role && showsAccessBanner(pathname, role) ? role : null

  return (
    <FocusModeContext.Provider value={setFocus}>
      <PageWidthContext.Provider value={setPageWidth}>
      <ShellInsetsContext.Provider value={insets}>
      <InShellContext.Provider value={true}>
        <div className="min-h-[100dvh] bg-page text-fg">
          {!focus && (desktop ? <SideNav /> : <TopBar />)}
          {/* Обёртка есть всегда (на телефоне без классов): иначе при смене
              ширины окна экран пересоздавался бы и терял набранное. */}
          <div className={withMenu ? 'pl-60' : undefined}>
            {/* pb на телефоне — ровно под плавающую навигацию: её высота
                (~69px) + отступ снизу (16px) + safe-area. Больше — и внизу
                зияет пустота. В режиме раунда навигации нет — хватает
                safe-area; на компьютере навигации снизу нет вовсе. */}
            <main
              className={`mx-auto min-h-[60vh] ${desktop && pageWidth ? 'max-w-page' : 'max-w-column'} animate-fade-in px-4 ${
                focus
                  ? 'pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+0.75rem)]'
                  : desktop
                    ? 'pb-10 pt-8'
                    : 'pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))]'
              }`}
            >
              {banner && <AccessEndedBanner role={banner} />}
              <Outlet />
            </main>
          </div>
          {!focus && !desktop && <BottomNav />}
        </div>
      </InShellContext.Provider>
      </ShellInsetsContext.Provider>
      </PageWidthContext.Provider>
    </FocusModeContext.Provider>
  )
}
