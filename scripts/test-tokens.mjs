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
  if (v === 'transparent') return [0, 0, 0, 0]
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
// «имя@доля» — токен долей, как в утилите: bg-danger/10 → 'danger@0.1'.
// Полупрозрачный фон кладётся на страницу, полупрозрачный текст — на фон.
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
  ['primary-fg', 'primary', TEXT], // главная кнопка (Button primary)
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
  // текст на мягкой подложке статуса и правки «было → стало»
  ['danger-soft-fg', 'page', TEXT],
  ['danger-soft-fg', 'surface', TEXT],
  ['danger-soft-fg', 'danger@0.1', TEXT],
  ['warning-soft-fg', 'page', TEXT],
  ['warning-soft-fg', 'surface', TEXT],
  ['warning-soft-fg', 'warning@0.1', TEXT],
  ['success-soft-fg', 'page', TEXT],
  ['success-soft-fg', 'surface', TEXT],
  ['success-soft-fg', 'success@0.15', TEXT],
  // глубокий тон долей: выбранный ответ, счётчик на карточке
  ['fg', 'danger-soft@0.4', TEXT],
  ['fg', 'success-soft@0.4', TEXT],
  ['warning-strong', 'warning-soft@0.5', TEXT],
  // статусная карточка (Card tone): заголовок, подпись долей, счётчик
  ['warning-soft-fg', 'warning-surface', TEXT],
  ['warning-strong@0.8', 'warning-surface', TEXT],
  ['danger-soft-fg', 'danger-surface', TEXT],
  ['fg-secondary', 'warning-surface', TEXT],
  // карточка-герой: подписи на градиенте, ссылка «Мой прогресс»
  ['fg-tertiary', 'hero', TEXT],
  ['fg-tertiary', 'hero-mid', TEXT],
  ['fg-muted', 'hero-edge', TEXT],
  ['accent-strong', 'hero-mid', TEXT],
  ['accent-strong', 'hero-edge', TEXT],
  // «Начать занятие»: текст на подложке главного призыва
  ['fg', 'cta', TEXT],
  ['fg', 'cta-end', TEXT],
  // текст поверх затемнения (подсказка жестов карточки)
  ['scrim-fg', 'scrim@0.6', TEXT],
]
// Только светлая: в тёмной у этих токенов значения нет — рамка прозрачная
// (так было всегда), проверяет блок «тёмная не меняется» ниже.
const LIGHT_ONLY = [
  ['control-line-active', 'surface', ICON], // выбранный вариант виден по рамке
]
for (const [name, theme, pairs] of [
  ['тёмная', dark, PAIRS],
  ['светлая', { ...dark, ...light }, [...PAIRS, ...LIGHT_ONLY]],
]) {
  const col = (spec) => {
    const [t, share] = spec.split('@')
    const v = theme[`--color-${t}`]
    if (!v) throw new Error(`нет токена --color-${t}`)
    const c = parse(v, theme)
    return share === undefined ? c : [c[0], c[1], c[2], c[3] * Number(share)]
  }
  const page = col('page')
  for (const [fg, bg, min] of pairs) {
    const base = over(col(bg), page) // полупрозрачный фон — поверх страницы
    const r = ratio(over(col(fg), base), base)
    check(`${name}: ${fg} на ${bg} ≥ ${min}:1`, r >= min, r.toFixed(2))
  }
}

// ── 2б. тёмная не меняется: тени и рамки чипов — только светлой ────────────
// Тень и рамка управления заведены ради светлой темы (30.09.2026). В тёмной
// рамка обязана быть прозрачной, а тень — НУЛЕВОЙ (0 0 #0000): прозрачную
// тень с размытием браузер всё равно рисует, и сглаживание скруглённых углов
// менялось на несколько пикселей (поймано сверкой скриншотов).
for (const t of ['control-line', 'control-line-active']) {
  const v = dark[`--color-${t}`]
  check(`тёмная: --color-${t} прозрачный (тёмная тема не меняется)`, v === 'transparent', v)
}
const rootDark = block(/\n:root\s*\{([\s\S]*?)\n\}/) ?? {}
for (const t of ['card', 'raised']) {
  check(`тень shadow-${t} берёт переменную темы`, dark[`--shadow-${t}`] === `var(--elevation-${t})`, dark[`--shadow-${t}`])
  check(`тёмная: --elevation-${t} нулевая (теней нет)`, rootDark[`--elevation-${t}`] === '0 0 #0000', rootDark[`--elevation-${t}`])
  check(`светлая: --elevation-${t} задана`, /\d+px/.test(light[`--elevation-${t}`] ?? ''), light[`--elevation-${t}`])
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
