// ============================================================================
// Общая рамка экранов в теме «Nocturne». Раскладка по ширине экрана
// (журнал п.45–46; архитектура §5, §16):
//   • телефон и планшет — шапка сверху (TopBar), плавающая нижняя навигация
//     (BottomNav);
//   • компьютер (от 1024 px) — меню слева (SideNav), шапки нет.
// Экраны, которые ещё не переехали в новую структуру, на любой ширине
// остаются колонкой 640 px; на компьютере — по центру места рядом с меню.
//
// Режим раунда (игра на весь экран) прячет навигацию на любой ширине —
// shared/lib/focusMode. Сколько места занимает каркас вокруг экрана, экраны
// с закреплёнными элементами узнают из shared/lib/shellInsets.
// ============================================================================
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { FocusModeContext } from '../../shared/lib/focusMode'
import { PHONE_INSETS, ShellInsetsContext, type ShellInsets } from '../../shared/lib/shellInsets'
import { useIsDesktop } from '../../shared/lib/useMediaQuery'
import { BottomNav } from './BottomNav'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'

/** Меню компьютера — 15rem (w-60 в SideNav, pl-60 ниже) слева; снизу ничего нет. */
const DESKTOP_INSETS: ShellInsets = { left: '15rem', bottom: '0px', bottomPx: 0 }
/** В раунде навигации нет ни снизу, ни слева. */
const FOCUS_INSETS: ShellInsets = { left: '0px', bottom: '0px', bottomPx: 0 }

export function Layout() {
  const [focus, setFocus] = useState(false)
  const desktop = useIsDesktop()
  const withMenu = desktop && !focus
  const insets = focus ? FOCUS_INSETS : desktop ? DESKTOP_INSETS : PHONE_INSETS

  return (
    <FocusModeContext.Provider value={setFocus}>
      <ShellInsetsContext.Provider value={insets}>
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
              className={`mx-auto min-h-[60vh] max-w-screen-sm animate-fade-in px-4 ${
                focus
                  ? 'pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+0.75rem)]'
                  : desktop
                    ? 'pb-10 pt-8'
                    : 'pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))]'
              }`}
            >
              <Outlet />
            </main>
          </div>
          {!focus && !desktop && <BottomNav />}
        </div>
      </ShellInsetsContext.Provider>
    </FocusModeContext.Provider>
  )
}
