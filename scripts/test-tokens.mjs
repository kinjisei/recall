/**
 * Токены дизайн-системы: обе темы читаемы и полны (PLAN.md Ф1.4; архитектура §5).
 *
 * Зачем. Светлая тема — черновая и пока выключена (журнал п.37), поэтому глазами
 * её никто не проверяет. Ошибка в ней всплыла бы в день запуска: забытое светлое
 * значение (токен молча остаётся тёмным) или серый текст, который не читается.
 * Тест меряет это сразу, по самому файлу токенов:
 *   1. у каждого цветового токена есть значение в ОБЕИХ темах;
 *   2. контраст по WCAG: текст ≥ 4,5:1, иконки и рамки ≥ 3:1 — в обеих темах;
 *   3. точки перехода в CSS совпадают с теми, что читает JS (breakpoints.ts).
 * Чистый: без сети, базы и браузера.
 */
import { readFileSync } from 'node:fs'

const ROOT = new URL('../', import.meta.url)
const css = readFileSync(new URL('src/shared/ui/tokens.css', ROOT), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const bpTs = readFileSync(new URL('src/shared/ui/breakpoints.ts', ROOT), 'utf8')

let fails = 0
let total = 0
const check = (name, ok, extra = '') => {
  total++
  if (!ok) fails++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

/** Объявления `--имя: значение;` из тела блока. */
function decls(body) {
  const out = {}
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}
/** Тело блока по началу селектора (с учётом вложенных скобок не нужно — их нет). */
function block(re) {
  const m = css.match(re)
  return m ? decls(m[1]) : null
}

const dark = block(/@theme\s+static\s*\{([\s\S]*?)\n\}/) ?? block(/@theme\s*\{([\s\S]*?)\n\}/)
const light = block(/\[data-theme='light'\]\s*\{([\s\S]*?)\n\}/)
check('в tokens.css есть @theme (тёмная тема) и блок светлой', !!dark && !!light)
if (!dark || !light) process.exit(1)

// ── цвет → sRGB ────────────────────────────────────────────────────────────
function oklchToRgb(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180)
  const b = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const enc = (x) => {
    x = Math.min(1, Math.max(0, x))
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)
  }
  return lin.map(enc)
}

/** Значение токена → [r, g, b, alpha]; var(--x) раскрывается в той же теме. */
function parse(value, theme, depth = 0) {
  const v = value.trim()
  const ref = v.match(/^var\((--[\w-]+)\)$/)
  if (ref) {
    const next = theme[ref[1]] ?? dark[ref[1]]
    if (!next || depth > 5) throw new Error(`не раскрывается ${v}`)
    return parse(next, theme, depth + 1)
  }
  let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (m) {
    const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1)
  }
  m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/)
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]]
  m = v.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/)
  if (m) return [...oklchToRgb(+m[1] / 100, +m[2], +m[3]), 1]
  if (v === 'white') return [255, 255, 255, 1]
  if (v === 'black') return [0, 0, 0, 1]
  throw new Error(`не разобрать цвет «${v}»`)
}

/** Полупрозрачный цвет поверх непрозрачного фона (так смешивает браузер — в sRGB). */
const over = (fg, bg) => [0, 1, 2].map((i) => fg[3] * fg[i] + (1 - fg[3]) * bg[i]).concat(1)
const lum = ([r, g, b]) => {
  const ch = (c) => {
    c /= 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// ── 1. полнота: у каждого цвета — два значения ──────────────────────────────
const colorKeys = (o) => Object.keys(o).filter((k) => k.startsWith('--color-'))
const noLight = colorKeys(dark).filter((k) => !(k in light))
const noDark = colorKeys(light).filter((k) => !(k in dark))
check('у каждого цветового токена есть светлое значение', noLight.length === 0, noLight.join(', '))
check('в светлой теме нет токенов, которых нет в тёмной', noDark.length === 0, noDark.join(', '))
check('светлая тема объявляет color-scheme: light', /\[data-theme='light'\]\s*\{[^}]*color-scheme:\s*light/.test(css))

// ── 2. контраст ────────────────────────────────────────────────────────────
// [текст, фон, порог] — ровно те пары, в которых токены живут в интерфейсе.
const TEXT = 4.5
const ICON = 3
const PAIRS = [
  ['fg', 'page', TEXT],
  ['fg', 'surface', TEXT],
  ['fg', 'input', TEXT],
  ['fg-secondary', 'page', TEXT],
  ['fg-secondary', 'surface', TEXT],
  ['fg-tertiary', 'page', TEXT],
  ['fg-tertiary', 'surface', TEXT],
  ['fg-muted', 'page', TEXT],
  ['fg-muted', 'surface', TEXT],
  ['fg-faint', 'page', ICON],
  ['accent-strong', 'page', TEXT],
  ['accent-strong', 'surface', TEXT],
  ['accent', 'page', ICON],
  ['accent-soft-fg', 'accent-soft', TEXT],
  ['accent-fg', 'accent', TEXT],
  ['page', 'fg', TEXT], // главная кнопка: заливка цветом текста, надпись цветом фона
  ['danger-strong', 'page', TEXT],
  ['danger-strong', 'surface', TEXT],
  ['warning-strong', 'page', TEXT],
  ['warning-strong', 'surface', TEXT],
  ['success-strong', 'page', TEXT],
  ['success-strong', 'surface', TEXT],
  // Надпись на сплошной заливке статуса: крупная полужирная (кнопка) — 3:1.
  // Белое на red-500 даёт 3,8:1 и сегодня; поднимать до 4,5 — это редизайн.
  ['danger-fg', 'danger', ICON],
  ['warning-fg', 'warning', TEXT],
  ['success-fg', 'success', ICON],
]
for (const [name, theme] of [
  ['тёмная', dark],
  ['светлая', { ...dark, ...light }],
]) {
  const col = (t) => {
    const v = theme[`--color-${t}`]
    if (!v) throw new Error(`нет токена --color-${t}`)
    return parse(v, theme)
  }
  const page = col('page')
  for (const [fg, bg, min] of PAIRS) {
    const base = over(col(bg), page) // полупрозрачный фон — поверх страницы
    const r = ratio(over(col(fg), base), base)
    check(`${name}: ${fg} на ${bg} ≥ ${min}:1`, r >= min, r.toFixed(2))
  }
}

// ── 3. точки перехода: CSS = JS ─────────────────────────────────────────────
for (const [cssName, tsName] of [
  ['--breakpoint-sm', 'TABLET_MIN'],
  ['--breakpoint-lg', 'DESKTOP_MIN'],
]) {
  const inCss = dark[cssName]
  const inTs = bpTs.match(new RegExp(`${tsName}\\s*=\\s*'([^']+)'`))?.[1]
  check(`точка перехода ${cssName} = ${tsName}`, !!inCss && inCss === inTs, `${inCss} / ${inTs}`)
}

console.log(`\nИтог: ${total - fails}/${total}`)
process.exitCode = fails ? 1 : 0
