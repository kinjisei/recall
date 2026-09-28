// ============================================================================
// Тема: тёмная (Nocturne), светлая или «как в системе» (журнал п.37;
// архитектура §5).
//
// Светлая тема — черновик до редизайна: 620 «сырых» цветов в старых экранах
// (text-white и соседи) на светлом фоне пропадают. Поэтому ВЫБОР ТЕМЫ ПОКА
// ТОЛЬКО У ВЛАДЕЛЬЦА И ТОЛЬКО ДЛЯ СЕБЯ (решение владельца 28.09.2026): блок в
// админке меняет тему этого устройства. У всех остальных тема тёмная —
// даже если телефон в светлом режиме: «как в системе» по умолчанию включится
// вместе с переключателем в Настройках (THEME_FOR_EVERYONE, PLAN.md Ф5.2).
//
// Выбор хранится на устройстве (localStorage `recall.theme`), а не в профиле:
// один человек держит разные устройства в разных темах.
//
// Тема ставится атрибутом data-theme на <html>; значения токенов под ним —
// shared/ui/tokens.css. Ставим ДО первого рендера (app/main.tsx), чтобы экран
// не мигнул тёмным. Вспышка между загрузкой страницы и запуском скрипта
// (пустой тёмный фон) у светлой темы остаётся: блокирующий скрипт в <head>
// стоил бы лишнего запроса на старте ВСЕМ ради одного владельца — вопрос
// решается при включении темы для всех (Ф5.2).
// ============================================================================
import { readRaw, writeRaw } from '../lib/storage'

export type ThemeChoice = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

/** Выбор темы открыт всем (переключатель в Настройках, «как в системе» по
 *  умолчанию). До редизайна — нет. */
export const THEME_FOR_EVERYONE = false

const KEY = 'recall.theme'
const SYSTEM_LIGHT = '(prefers-color-scheme: light)'

const isChoice = (v: string | null): v is ThemeChoice => v === 'system' || v === 'light' || v === 'dark'

/** Что выбрано на этом устройстве. Никто не выбирал — тёмная (пока тема не для всех). */
export function themeChoice(): ThemeChoice {
  const saved = readRaw(KEY)
  if (isChoice(saved)) return saved
  return THEME_FOR_EVERYONE ? 'system' : 'dark'
}

/** Какая тема получается из выбора: «как в системе» спрашивает телефон. */
export function resolveTheme(choice: ThemeChoice, systemLight: boolean): Theme {
  if (choice === 'system') return systemLight ? 'light' : 'dark'
  return choice
}

let unwatch: (() => void) | null = null

/** Поставить тему на страницу и следить за системой, если выбрано «как в системе». */
export function applyTheme(choice: ThemeChoice = themeChoice()): void {
  const media = window.matchMedia(SYSTEM_LIGHT)
  const paint = () => {
    const theme = resolveTheme(choice, media.matches)
    document.documentElement.dataset.theme = theme
    // цвет строки состояния телефона — под фон страницы этой темы
    const page = getComputedStyle(document.documentElement).getPropertyValue('--color-page').trim()
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

/** Сохранить выбор этого устройства и сразу применить. */
export function setThemeChoice(choice: ThemeChoice): void {
  writeRaw(KEY, choice)
  applyTheme(choice)
}
