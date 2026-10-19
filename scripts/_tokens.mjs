/**
 * Разбор src/shared/ui/tokens.css для проверок (test-tokens, test-theme-boot):
 * объявления `--имя: значение` каждого блока и четыре варианта вида —
 * «Сумерки» и «Закат» × тёмная и светлая (PLAN.md Ф2.17-2).
 */
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/shared/ui/tokens.css', import.meta.url), 'utf8')
  .replace(/\r\n?/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** Текст файла без комментариев — для проверок по селекторам. */
export const tokensCss = css

/** Объявления `--имя: значение;` из тела блока. */
function decls(body) {
  const out = {}
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

/** Тело блока по селектору (вложенных скобок в блоках токенов нет). */
function block(selector) {
  const m = css.match(new RegExp(selector.source + String.raw`\s*\{([\s\S]*?)\n\}`))
  return m ? { decls: decls(m[1]), body: m[1] } : null
}

/**
 * Блоки как они записаны: theme — @theme («Сумерки» · тёмная и всё
 * нецветовое), root — переменные тёмной темы (тени, затемнение),
 * twilightLight, sunsetDark, sunsetLight — свои значения варианта.
 */
export const blocks = {
  theme: block(/@theme\s+static/),
  root: block(/\n:root/),
  twilightLight: block(/:root\[data-theme='light'\],\s*\[data-theme='light'\]/),
  sunsetDark: block(/:root\[data-palette='sunset'\]/),
  sunsetLight: block(/:root\[data-palette='sunset'\]\[data-theme='light'\],\s*\[data-palette='sunset'\] \[data-theme='light'\]/),
}

/** Варианты так, как их видит <html>: каскад блоков по порядку. */
export function variants() {
  const { theme, root, twilightLight, sunsetDark, sunsetLight } = blocks
  if (!theme || !root || !twilightLight || !sunsetDark || !sunsetLight) return null
  const base = { ...theme.decls, ...root.decls }
  return {
    'сумерки · тёмная': { palette: 'twilight', theme: 'dark', t: base },
    'сумерки · светлая': { palette: 'twilight', theme: 'light', t: { ...base, ...twilightLight.decls } },
    'закат · тёмная': { palette: 'sunset', theme: 'dark', t: { ...base, ...sunsetDark.decls } },
    'закат · светлая': { palette: 'sunset', theme: 'light', t: { ...base, ...sunsetDark.decls, ...sunsetLight.decls } },
  }
}
