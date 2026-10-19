// ============================================================================
// Геометрия каркаса по правилам d0 (журнал п.55) — чистые функции, без DOM.
//
//   окно → меню (240 / рельс 72 / нет) → ОБЛАСТЬ = окно − меню
//   область → поля 24 · 32 · 40 → СОДЕРЖИМОЕ = область − 2 × поле
//
// Каркас (app/shell/Layout) ставит по этим числам поля, отдаёт раскладкам
// ширину содержимого и решает, сдвинет ли правая панель содержимое или ляжет
// поверх (правило 8). Область — от ширины окна, как в правилах d0
// (useAreaSize). Чистый тест — scripts/test-shell-geometry.mjs; импорт с
// расширением .ts — его читает node.
// ============================================================================
import { AREA_PAD, MENU_PX, RAIL_PX, SIDE_PX } from '../ui/breakpoints.ts'

export type ShellMode = 'phone' | 'rail' | 'menu'

/**
 * Какое меню у окна: уже 720 — телефонное (шапка и нижняя панель), до 1280 —
 * рельс 72, дальше — меню 240, если его не свернули руками.
 */
export function shellMode(railWide: boolean, menuWide: boolean, collapsed: boolean): ShellMode {
  if (!railWide) return 'phone'
  return menuWide && !collapsed ? 'menu' : 'rail'
}

/** Ширина меню слева, px. */
export function menuWidth(mode: ShellMode): number {
  return mode === 'menu' ? MENU_PX : mode === 'rail' ? RAIL_PX : 0
}

/** Поле области по её ширине, px: 24 при области < 1040, 32 до 1200, дальше 40. */
export function areaPad(area: number): number {
  return area >= AREA_PAD.lg ? 40 : area >= AREA_PAD.md ? 32 : 24
}

/** Ширина содержимого для области, px. */
export function contentOf(area: number): number {
  return Math.max(0, area - 2 * areaPad(area))
}

/**
 * Сдвинет ли правая панель (440) содержимое без затемнения: да, если
 * оставшейся области хватает раскладке (`need`: колонка 600, неделя 700,
 * «список + подробности» 880 — d0, правило 8). Иначе панель ложится поверх с
 * лёгкой дымкой. Так на 1440 неделя сдвигается (1200 − 440 = 760, d2), а
 * «список + подробности» — нет (d3-4); поля после сдвига пересчитываются.
 */
export function panelPushes(area: number, need: number): boolean {
  return area - SIDE_PX >= need
}
