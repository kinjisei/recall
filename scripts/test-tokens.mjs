/**
 * Токены дизайн-системы: все четыре варианта вида полны и читаемы (PLAN.md
 * Ф1.4, Ф2.17-2; архитектура §5).
 *
 * Зачем. Вариантов четыре — «Сумерки» и «Закат» × тёмная и светлая (лист
 * design/mockups/s2-style-colors.html), а глазами каждый день смотрят один.
 * Ошибка в остальных всплыла бы у клиента: забытое значение (токен молча
 * берёт цвет другого варианта) или серый текст, который не читается. Тест
 * меряет это сразу, по самому файлу токенов:
 *   1. у каждого цветового токена есть значение в КАЖДОМ варианте (и на
 *      отдельном светлом блоке — печатный лист);
 *   2. контраст по WCAG: текст ≥ 4,5:1, иконки и рамки ≥ 3:1 — в каждом;
 *   3. превью и образцы выбора вида в Настройках равны настоящим значениям;
 *   4. в тёмной теней нет; роли, которых нет на листе, выведены по правилу;
 *   5. точки перехода в CSS совпадают с теми, что читает JS (breakpoints.ts).
 * Чистый: без сети, базы и браузера.
 */
import { readFileSync } from 'node:fs'
import { blocks, tokensCss, variants } from './_tokens.mjs'

const bpTs = readFileSync(new URL('../src/shared/ui/breakpoints.ts', import.meta.url), 'utf8')

let fails = 0
let total = 0
const check = (name, ok, extra = '') => {
  total++
  if (!ok) fails++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

const V = variants()
check('в tokens.css есть @theme, :root и блоки трёх других вариантов', !!V)
if (!V) process.exit(1)
const dark = blocks.theme.decls

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

/** Значение токена → [r, g, b, alpha]; var(--x) раскрывается в том же варианте. */
function parse(value, theme, depth = 0) {
  const v = value.trim()
  const ref = v.match(/^var\((--[\w-]+)\)$/)
  if (ref) {
    const next = theme[ref[1]]
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
  if (v === 'transparent') return [0, 0, 0, 0]
  throw new Error(`не разобрать цвет «${v}»`)
}
const hex = (value, theme) =>
  parse(value, theme)
    .slice(0, 3)
    .map((c) => Math.round(c).toString(16).padStart(2, '0'))
    .join('')

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

// ── 1. полнота ─────────────────────────────────────────────────────────────
// Две группы зависят только от палитры, а не от темы (выбор вида в
// Настройках): превью — в @theme и в блоке «Заката», образцы — только в @theme.
const PALETTE_ONLY = /^--color-preview-/
const CONSTANT = /^--color-swatch-/
const colorKeys = (o) => Object.keys(o).filter((k) => k.startsWith('--color-'))
const themed = colorKeys(dark).filter((k) => !PALETTE_ONLY.test(k) && !CONSTANT.test(k))
for (const [name, b, extra] of [
  ['сумерки · светлая', blocks.twilightLight, []],
  ['закат · тёмная', blocks.sunsetDark, colorKeys(dark).filter((k) => PALETTE_ONLY.test(k))],
  ['закат · светлая', blocks.sunsetLight, []],
]) {
  const need = [...themed, ...extra]
  const missing = need.filter((k) => !(k in b.decls))
  const unknown = colorKeys(b.decls).filter((k) => !need.includes(k))
  check(`${name}: задан каждый цветовой токен`, missing.length === 0, missing.join(', '))
  check(`${name}: нет лишних (чужих или неизвестных @theme) токенов`, unknown.length === 0, unknown.join(', '))
}
const VARS = ['--elevation-card', '--elevation-raised', '--elevation-sheet', '--scrim-sheet']
for (const [name, b] of [
  ['тёмная (:root)', blocks.root],
  ['сумерки · светлая', blocks.twilightLight],
  ['закат · светлая', blocks.sunsetLight],
]) {
  const missing = VARS.filter((k) => !(k in b.decls))
  check(`${name}: заданы тени и затемнение шторки`, missing.length === 0, missing.join(', '))
}
for (const [name, b] of [
  ['сумерки · светлая', blocks.twilightLight],
  ['закат · светлая', blocks.sunsetLight],
]) {
  check(`${name}: color-scheme: light`, /color-scheme:\s*light/.test(b.body))
}
check('тёмная: color-scheme: dark у :root', /color-scheme:\s*dark/.test(blocks.root.body))
check('cta и cta-end удалены (s2: «Начать занятие» — главная кнопка)', !/--color-cta/.test(tokensCss))

// ── 2. контраст ────────────────────────────────────────────────────────────
// [текст, фон, порог] — ровно те пары, в которых токены живут в интерфейсе
// (и те, что лист s2 обещает в колонке «контраст»). «имя@доля» — токен долей,
// как в утилите: bg-danger/10 → 'danger@0.1'. Полупрозрачный фон кладётся на
// страницу, полупрозрачный текст — на фон.
const TEXT = 4.5
const ICON = 3
const LARGE = 3 // крупный текст по WCAG: от 24 px или от 18,66 px полужирным
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
  ['fg-muted', 'input', TEXT], // плейсхолдер в поле
  ['fg-faint', 'page', ICON],
  ['accent-strong', 'page', TEXT],
  ['accent-strong', 'surface', TEXT],
  // акцент — не текст; к surface, как на листе (у «Заката» светлого на page
  // оранжевый не дотягивает — там фокус и иконки энергии тёмным оттенком)
  ['accent', 'surface', ICON],
  ['accent-soft-fg', 'accent-soft', TEXT],
  ['accent-fg', 'accent', TEXT],
  ['primary-fg', 'primary', TEXT], // главная кнопка
  ['primary-fg', 'primary-press', TEXT], // нажатая главная кнопка
  ['focus', 'page', ICON], // кольцо фокуса
  ['control-line', 'surface', ICON], // рамка поля и чипа — граница элемента
  ['control-line-active', 'surface', ICON], // выбранный вариант виден по рамке
  ['danger-strong', 'page', TEXT],
  ['danger-strong', 'surface', TEXT],
  ['warning-strong', 'page', TEXT],
  ['warning-strong', 'surface', TEXT],
  ['success-strong', 'page', TEXT],
  ['success-strong', 'surface', TEXT],
  // надпись на сплошной заливке статуса (с листа s2 — все ≥ 4,5)
  ['danger-fg', 'danger', TEXT],
  ['warning-fg', 'warning', TEXT],
  ['success-fg', 'success', TEXT],
  // текст на мягкой подложке статуса и правки «было → стало»
  ['danger-soft-fg', 'page', TEXT],
  ['danger-soft-fg', 'surface', TEXT],
  ['danger-soft-fg', 'danger@0.1', TEXT],
  ['danger-soft-fg', 'danger-soft', TEXT],
  ['warning-soft-fg', 'page', TEXT],
  ['warning-soft-fg', 'surface', TEXT],
  ['warning-soft-fg', 'warning@0.1', TEXT],
  ['warning-soft-fg', 'warning-soft', TEXT],
  ['success-soft-fg', 'page', TEXT],
  ['success-soft-fg', 'surface', TEXT],
  ['success-soft-fg', 'success@0.15', TEXT],
  ['success-soft-fg', 'success-soft', TEXT],
  // глубокий тон долей: выбранный ответ, счётчик на карточке
  ['fg', 'danger-soft@0.4', TEXT],
  ['fg', 'success-soft@0.4', TEXT],
  ['warning-strong', 'warning-soft@0.5', TEXT],
  // статусная карточка (Card tone): заголовок, подпись долей, счётчик
  ['danger-strong', 'danger-surface', TEXT],
  ['warning-strong', 'warning-surface', TEXT],
  ['success-strong', 'success-surface', TEXT],
  ['warning-soft-fg', 'warning-surface', TEXT],
  ['danger-soft-fg', 'danger-surface', TEXT],
  ['fg-secondary', 'warning-surface', TEXT],
  // карточка-герой и «билет» рефералки: подписи на градиенте, ссылка
  // «Мой прогресс», пунктир будущего дня
  ['accent-soft-fg', 'hero', TEXT],
  ['accent-strong', 'hero', LARGE], // крупная цифра билета (30 px)
  ['fg-secondary', 'hero', TEXT], // подписи билета
  ['fg-tertiary', 'hero', TEXT],
  ['fg-tertiary', 'hero-mid', TEXT],
  ['fg-muted', 'hero-edge', TEXT],
  ['accent-strong', 'hero-mid', TEXT],
  ['accent-strong', 'hero-edge', TEXT],
  ['ring', 'hero', ICON],
  // текст поверх затемнения (подсказка жестов карточки)
  ['scrim-fg', 'scrim@0.6', TEXT],
]
// Серии графика — 3:1 к карточке только в тёмной (в светлой по палитре
// dataviz три серии бледнее — у графика всегда подписи, ChartView)
const DARK_ONLY = [1, 2, 3, 4, 5, 6].map((n) => [`chart-${n}`, 'surface', ICON])
for (const [name, { t, theme }] of Object.entries(V)) {
  const pairs = theme === 'dark' ? [...PAIRS, ...DARK_ONLY] : PAIRS
  const col = (spec) => {
    const [tk, share] = spec.split('@')
    const v = t[`--color-${tk}`]
    if (!v) throw new Error(`нет токена --color-${tk}`)
    const c = parse(v, t)
    return share === undefined ? c : [c[0], c[1], c[2], c[3] * Number(share)]
  }
  const page = col('page')
  for (const [fg, bg, min] of pairs) {
    const base = over(col(bg), page) // полупрозрачный фон — поверх страницы
    const r = ratio(over(col(fg), base), base)
    check(`${name}: ${fg} на ${bg} ≥ ${min}:1`, r >= min, r.toFixed(2))
  }
}

// ── 3. превью и образцы выбора вида (Настройки, макет u4) ─────────────────
// Превью «Светлая» и «Тёмная» рисуют обе темы нынешней палитры; разойдутся с
// настоящими значениями — человек выберет одно, а получит другое.
const PREVIEW = [
  ['light-page', 'light', 'page'],
  ['light-card', 'light', 'surface'],
  ['light-accent', 'light', 'primary'],
  ['light-fg', 'light', 'fg'],
  ['dark-page', 'dark', 'page'],
  ['dark-card', 'dark', 'input'],
  ['dark-accent', 'dark', 'primary'],
  ['dark-fg', 'dark', 'fg'],
]
const variantOf = (palette, theme) => Object.values(V).find((v) => v.palette === palette && v.theme === theme).t
for (const palette of ['twilight', 'sunset']) {
  for (const [name, theme, real] of PREVIEW) {
    const here = variantOf(palette, 'dark') // превью зависит только от палитры
    const want = variantOf(palette, theme)
    const a = hex(here[`--color-preview-${name}`], here)
    const b = hex(want[`--color-${real}`], want)
    check(`превью ${palette}: preview-${name} = ${real} (${theme})`, a === b, `${a} / ${b}`)
  }
}
// Кружок палитры: от акцента-текста светлой через акцент к светлому тону тёмной
const SWATCH = {
  twilight: [['from', 'light', 'accent-strong'], ['via', 'light', 'accent'], ['to', 'dark', 'primary']],
  sunset: [['from', 'light', 'accent-strong'], ['via', 'light', 'accent'], ['to', 'dark', 'accent-strong']],
}
for (const [palette, stops] of Object.entries(SWATCH)) {
  for (const [stop, theme, real] of stops) {
    const want = variantOf(palette, theme)
    const a = hex(dark[`--color-swatch-${palette}-${stop}`], dark)
    const b = hex(want[`--color-${real}`], want)
    check(`образец ${palette}-${stop} = ${real} (${theme})`, a === b, `${a} / ${b}`)
  }
}

// ── 4. правила листа: тени, выведенные роли ────────────────────────────────
// Тёмная — без теней (s2, «Глубина»): НУЛЕВАЯ тень (0 0 #0000), а не
// прозрачная — прозрачную с размытием браузер всё равно рисует, и у
// скруглённых углов менялось сглаживание (замер по пикселям 30.09.2026).
for (const t of ['card', 'raised', 'sheet']) {
  check(`тень shadow-${t} берёт переменную темы`, dark[`--shadow-${t}`] === `var(--elevation-${t})`, dark[`--shadow-${t}`])
  check(`тёмная: --elevation-${t} нулевая (теней нет)`, blocks.root.decls[`--elevation-${t}`] === '0 0 #0000', blocks.root.decls[`--elevation-${t}`])
  for (const [name, b] of [['сумерки · светлая', blocks.twilightLight], ['закат · светлая', blocks.sunsetLight]]) {
    check(`${name}: --elevation-${t} — настоящая тень`, /\d+px/.test(b.decls[`--elevation-${t}`] ?? ''), b.decls[`--elevation-${t}`])
  }
}
// -soft-fg на листе нет — равен -strong своего варианта, кроме success в
// светлых (там темнее ради подложки bg-success/15; её держат пары выше). Так
// записано в tokens.css; разойдутся — описание соврёт.
for (const [name, { t, theme }] of Object.entries(V)) {
  for (const s of theme === 'light' ? ['danger', 'warning'] : ['danger', 'warning', 'success']) {
    const a = hex(t[`--color-${s}-soft-fg`], t)
    const b = hex(t[`--color-${s}-strong`], t)
    check(`${name}: ${s}-soft-fg = ${s}-strong`, a === b, `${a} / ${b}`)
  }
}

// ── 5. точки перехода и пороги раскладок: CSS = JS ──────────────────────────
for (const [cssName, tsName] of [
  ['--breakpoint-sm', 'TABLET_MIN'],
  ['--breakpoint-rail', 'RAIL_MIN'],
  ['--breakpoint-lg', 'DESKTOP_MIN'],
  ['--breakpoint-menu', 'MENU_MIN'],
]) {
  const inCss = dark[cssName]
  const inTs = bpTs.match(new RegExp(`${tsName}\\s*=\\s*'([^']+)'`))?.[1]
  check(`точка перехода ${cssName} = ${tsName}`, !!inCss && inCss === inTs, `${inCss} / ${inTs}`)
}

// Пороги по ширине содержимого (d0): контейнерный запрос в CSS и AREA / SIDE_PX
// в JS. Разойдутся — колонки встанут по CSS при одной ширине, а JS
// (сдвиг панели, «список или подробности») решит по другой.
const tsNum = (re) => Number(bpTs.match(re)?.[1])
const rem = (v) => (/^[\d.]+rem$/.test(v ?? '') ? parseFloat(v) * 16 : NaN)
for (const [cssName, px, label] of [
  ['--container-week', tsNum(/\bweek: (\d+)/), 'AREA.week'],
  ['--container-split', tsNum(/\bsplit: (\d+)/), 'AREA.split'],
  ['--container-reading-split', tsNum(/\breadingSplit: (\d+)/), 'AREA.readingSplit'],
  ['--container-home-split', tsNum(/\bhomeSplit: (\d+)/), 'AREA.homeSplit'],
  ['--container-exercise-sides', tsNum(/\bexerciseSides: (\d+)/), 'AREA.exerciseSides'],
  ['--container-side', tsNum(/SIDE_PX = (\d+)/), 'SIDE_PX'],
  ['--container-list', 352, 'список 352 (d0, правило 4)'],
  ['--container-page', 1200, 'предел 1200 (d0, правило 3)'],
  ['--container-wide', 1600, 'предел 1600 (d0, правило 3)'],
  ['--container-bubble', 480, 'пузырь сообщения 480 (d0, правило 5)'],
  ['--container-reading', 680, 'чтение 680 (d0, правило 4)'],
  ['--container-exercise', 600, 'упражнение 600 (d0, правило 4)'],
]) {
  const inCss = rem(dark[cssName])
  check(`порог ${cssName} = ${label}`, Number.isFinite(px) && inCss === px, `${inCss} / ${px}`)
}

console.log(`\nИтог: ${total - fails}/${total}`)
process.exitCode = fails ? 1 : 0
