// ============================================================================
// Общая рамка экранов. Раскладка по ширине окна (журнал п.45–46, п.55;
// правила d0; архитектура §5, §16):
//   • телефон (уже 720) — шапка сверху (TopBar), плавающая нижняя навигация
//     (BottomNav);
//   • 720–1279 — рельс 72 слева (SideNav rail), шапки нет;
//   • от 1280 — меню 240 с подписями (SideNav), свернуть до рельса можно руками.
//
// Справа от меню — ОБЛАСТЬ, в ней поля 24 · 32 · 40 по её ширине и СОДЕРЖИМОЕ
// по центру (числа — shared/lib/shellGeometry, от ширины окна: useAreaSize). Старый экран — колонка 640 px;
// общая раскладка из shared/ui просит ширину страницы: обычную до 1200 или
// широкую до 1600 (shared/lib/screenWidth). Свыше растут поля. Ширину
// содержимого каркас отдаёт раскладкам: они переключаются по ней, а не по
// окну, — и не перестраиваются, когда панель сдвинула содержимое (неделя
// сжимается, но остаётся колонками, d2). Правая панель (шторка от 720)
// сдвигает содержимое, если оставшейся области хватает раскладке, иначе
// ложится поверх — shared/lib/sidePanel. Блок вокруг <main> — контейнер
// `area`: CSS экрана может спросить реальную ширину (`@split/area:…`).
//
// Режим раунда (игра на весь экран) прячет навигацию на любой ширине —
// shared/lib/focusMode. Сколько места занимает каркас вокруг экрана, экраны
// с закреплёнными элементами узнают из shared/lib/shellInsets, куда «наверх»
// с экранов ученика у этой роли — из shared/lib/shellUp (Ф2.18).
//
// Над стартовым экраном и студией — плашка «Тариф закончился — продлить»
// (PLAN.md Ф2.4; где — navigation.ts, что сказать — features/billing).
// Push (Ф2.9): подписка этого устройства и переход по нажатию на уведомление —
// usePushBridge.
// ============================================================================
import { useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AccessEndedBanner } from '../../features/billing'
import { GuidedBar } from '../../features/dashboard'
import { FocusModeContext } from '../../shared/lib/focusMode'
import { ContentWidthContext, PageWidthContext, type PageWant } from '../../shared/lib/screenWidth'
import { areaPad, menuWidth, panelPushes } from '../../shared/lib/shellGeometry'
import { InShellContext, PHONE_INSETS, ShellInsetsContext, type ShellInsets } from '../../shared/lib/shellInsets'
import { ShellUpContext, type ShellUp } from '../../shared/lib/shellUp'
import { SidePanelContext, type SidePanelSlot } from '../../shared/lib/sidePanel'
import { COLUMN_NEED, SIDE_PX } from '../../shared/ui/breakpoints'
import { learnHome, showsAccessBanner, tabUp } from '../navigation'
import { BottomNav } from './BottomNav'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'
import { useAreaSize } from './useAreaSize'
import { useMyRole } from './useMyRole'
import { usePushBridge } from './usePushBridge'
import { useShellMode } from './useShellMode'

/** Ширина содержимого по запросу экрана: колонка старого экрана, страница, широкая. */
const WIDTH_CLASS = { column: 'max-w-column px-4', page: 'max-w-page', wide: 'max-w-wide' } as const
/** Поля области 24 · 32 · 40 (d0, правило 2). */
const PAD_CLASS: Record<number, string> = { 24: 'px-6', 32: 'px-8', 40: 'px-10' }

export function Layout() {
  const [focus, setFocus] = useState(false)
  const [want, setWant] = useState<PageWant | null>(null)
  const [pushed, setPushed] = useState(false)
  const { mode, collapsible, toggle } = useShellMode()
  const phone = mode === 'phone'
  const menuPx = focus ? 0 : menuWidth(mode)
  const { area, content } = useAreaSize(menuPx, phone)
  const role = useMyRole()
  const { pathname } = useLocation()
  const banner = !focus && role && showsAccessBanner(pathname, role) ? role : null
  // куда «наверх» с экранов ученика у этой роли (Ф2.18); memo — чтобы экраны
  // не перерисовывались от нового объекта на каждый кадр каркаса
  const up = useMemo<ShellUp>(() => ({ tab: tabUp(pathname, role), home: learnHome(role) }), [pathname, role])
  const insets = useMemo<ShellInsets>(
    () => (phone && !focus ? PHONE_INSETS : { left: `${menuPx / 16}rem`, bottom: '0px', bottomPx: 0 }),
    [phone, focus, menuPx],
  )
  const fits = !phone && !focus && panelPushes(area, want?.need ?? COLUMN_NEED)
  const slot = useMemo<SidePanelSlot>(() => ({ fits, left: insets.left, setPushed }), [fits, insets.left])
  usePushBridge()

  const push = pushed && fits
  const shellClass = phone ? undefined : `${menuPx === 240 ? 'pl-60' : menuPx ? 'pl-18' : ''} ${push ? 'pr-(--container-side)' : ''}`
  // поля — по области, которая осталась содержимому (со сдвигом панели — без неё)
  const areaClass = phone ? undefined : `@container/area ${PAD_CLASS[areaPad(area - (push ? SIDE_PX : 0))]}`
  const width = phone ? WIDTH_CLASS.column : WIDTH_CLASS[want?.width ?? 'column']

  return (
    <FocusModeContext.Provider value={setFocus}>
      <PageWidthContext.Provider value={setWant}>
      <ContentWidthContext.Provider value={content}>
      <SidePanelContext.Provider value={slot}>
      <ShellInsetsContext.Provider value={insets}>
      <ShellUpContext.Provider value={up}>
      <InShellContext.Provider value={true}>
        <div className="min-h-[100dvh] bg-page text-fg">
          {!focus && (phone ? <TopBar /> : <SideNav rail={mode === 'rail'} collapsible={collapsible} onToggle={toggle} />)}
          {/* Обёртки есть всегда (на телефоне без классов): иначе при смене
              ширины окна экран пересоздавался бы и терял набранное. */}
          <div className={shellClass} data-shell={phone ? 'phone' : push ? `${mode} push` : mode}>
            <div className={areaClass}>
              {/* pb на телефоне — ровно под плавающую навигацию: её высота
                  (~69px) + отступ снизу (16px) + safe-area. Больше — и внизу
                  зияет пустота. В режиме раунда навигации нет — хватает
                  safe-area; с меню слева навигации снизу нет вовсе. */}
              <main
                className={`mx-auto min-h-[60vh] ${width} animate-fade-in ${
                  focus
                    ? 'pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+0.75rem)]'
                    : phone
                      ? 'pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))]'
                      : 'pb-10 pt-8'
                }`}
              >
                {banner && <AccessEndedBanner role={banner} />}
                <Outlet />
                {/* ведомое занятие: шаг сделан — «Дальше: …» под любым экраном */}
                <GuidedBar />
              </main>
            </div>
          </div>
          {!focus && phone && <BottomNav />}
        </div>
      </InShellContext.Provider>
      </ShellUpContext.Provider>
      </ShellInsetsContext.Provider>
      </SidePanelContext.Provider>
      </ContentWidthContext.Provider>
      </PageWidthContext.Provider>
    </FocusModeContext.Provider>
  )
}
