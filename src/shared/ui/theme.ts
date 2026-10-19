// ============================================================================
// Вид приложения: палитра («Сумерки» / «Закат») × тема («Как в системе» /
// «Светлая» / «Тёмная») — журнал п.37, п.56, п.71; макет u4; PLAN.md Ф2.17-2.
//
// Выбор хранится на устройстве (localStorage `recall.theme`,
// `recall.palette`), а не в профиле: один человек держит разные устройства
// по-разному. Никто не выбирал — «Сумерки» и тема телефона, у всех и везде:
// лендинг, вход и онбординг тоже (журнал п.71).
//
// Ставится атрибутами на <html>: data-theme (light | dark) и data-palette
// (sunset; у «Сумерек» атрибута нет), значения токенов под ними —
// shared/ui/tokens.css. ДО первой отрисовки атрибуты ставит маленький скрипт
// в index.html — иначе у светлой темы мелькал тёмный фон. Он повторяет
// themeChoice / paletteChoice / resolveTheme отсюда; хэш скрипта — в CSP
// (vercel.json). И равенство, и хэш сверяет scripts/test-theme-boot.mjs; при
// расхождении хэша CSP скрипт не пустит, и вернётся только прежняя вспышка:
// дальше тему ставит applyTheme из app/main.tsx, он же следит за телефоном
// при «Как в системе».
// ============================================================================
import { readRaw, writeRaw } from '../lib/storage.ts'

export type ThemeChoice = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'
export type Palette = 'twilight' | 'sunset'

const THEME_KEY = 'recall.theme'
const PALETTE_KEY = 'recall.palette'
const SYSTEM_LIGHT = '(prefers-color-scheme: light)'
/** Переход цветов при смене вида — 200 мс (u4-3); атрибут снимаем с запасом. */
const SWITCH_MS = 260

const isChoice = (v: string | null): v is ThemeChoice => v === 'system' || v === 'light' || v === 'dark'

/** Тема, выбранная на этом устройстве. Никто не выбирал — как в телефоне. */
export function themeChoice(): ThemeChoice {
  const saved = readRaw(THEME_KEY)
  return isChoice(saved) ? saved : 'system'
}

/** Палитра этого устройства. Никто не выбирал — «Сумерки». */
export function paletteChoice(): Palette {
  return readRaw(PALETTE_KEY) === 'sunset' ? 'sunset' : 'twilight'
}

/** Какая тема получается из выбора: «как в системе» спрашивает телефон. */
export function resolveTheme(choice: ThemeChoice, systemLight: boolean): Theme {
  if (choice === 'system') return systemLight ? 'light' : 'dark'
  return choice
}

let unwatch: (() => void) | null = null
let switchTimer = 0

/** Поставить вид на страницу и следить за системой, если выбрано «как в системе». */
export function applyTheme(choice: ThemeChoice = themeChoice(), palette: Palette = paletteChoice()): void {
  const root = document.documentElement
  const media = window.matchMedia(SYSTEM_LIGHT)
  const paint = () => {
    root.dataset.theme = resolveTheme(choice, media.matches)
    if (palette === 'sunset') root.dataset.palette = palette
    else delete root.dataset.palette
    // цвет строки состояния телефона — под фон страницы этого варианта, сразу
    const page = getComputedStyle(root).getPropertyValue('--color-page').trim()
    if (page) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', page)
  }
  unwatch?.()
  unwatch = null
  paint()
  if (choice === 'system') {
    media.addEventListener('change', paint)
    unwatch = () => media.removeEventListener('change', paint)
  }
}

/**
 * Сменить вид плавно (u4-3): фон, карточки, текст, иконки и рамки перетекают
 * в новые цвета за 200 мс ease-out — правило `html[data-theme-switch]` в
 * src/index.css; при «уменьшить движение» оно не действует, и всё сразу.
 * Прокрутка, открытая шторка и набранное остаются: страница не
 * перезагружается.
 */
function switchSmoothly(apply: () => void): void {
  const root = document.documentElement
  root.dataset.themeSwitch = ''
  apply()
  window.clearTimeout(switchTimer)
  switchTimer = window.setTimeout(() => delete root.dataset.themeSwitch, SWITCH_MS)
}

/** Сохранить тему этого устройства и сразу применить. */
export function setThemeChoice(choice: ThemeChoice): void {
  writeRaw(THEME_KEY, choice)
  switchSmoothly(() => applyTheme(choice))
}

/** Сохранить палитру этого устройства и сразу применить. */
export function setPalette(palette: Palette): void {
  writeRaw(PALETTE_KEY, palette)
  switchSmoothly(() => applyTheme(themeChoice(), palette))
}
