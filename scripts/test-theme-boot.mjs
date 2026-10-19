/**
 * Вид без вспышки на старте (PLAN.md Ф2.17-2, журнал п.75): скрипт в <head>
 * index.html ставит data-theme и data-palette до первой отрисовки — иначе у
 * светлой темы и у «Заката» мелькал тёмный фон «Сумерек».
 *
 * Встроенный скрипт CSP пускает только по хэшу (vercel.json, script-src).
 * Тест проверяет:
 *   1. хэш скрипта стоит в CSP, а 'unsafe-inline' — нет (иначе Vercel скрипт
 *      не пустит, и вернётся вспышка; поломки не будет — тему поставит
 *      app/main.tsx);
 *   2. в свежей сборке dist/index.html скрипт тот же байт в байт (CI
 *      собирает перед тестами);
 *   3. скрипт решает так же, как src/shared/ui/theme.ts, на всех сочетаниях
 *      «что сохранено × телефон светлый или тёмный», и закрытое хранилище
 *      (приватный режим) его не роняет;
 *   4. цвет строки состояния в скрипте = фон страницы варианта (tokens.css).
 * Чистый: без сети и браузера.
 *
 * Запуск: node scripts/test-theme-boot.mjs
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import vm from 'node:vm'
import { variants } from './_tokens.mjs'

const root = new URL('../', import.meta.url)
const read = (p) => readFileSync(new URL(p, root), 'utf8')

let fails = 0
let total = 0
const check = (name, ok, extra = '') => {
  total++
  if (!ok) fails++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

/** Встроенные (не module, без src) скрипты страницы. */
const inlineScripts = (html) => [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
const hashOf = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`

// ── 1. хэш в CSP ───────────────────────────────────────────────────────────
const html = read('index.html')
const scripts = inlineScripts(html)
check('в index.html ровно один встроенный скрипт', scripts.length === 1, String(scripts.length))
const script = scripts[0] ?? ''
check('скрипт с переводами строк LF (как соберёт Vercel; .gitattributes)', !script.includes('\r'))
const beforeModule = html.indexOf('<script>') < html.indexOf('<script type="module"')
check('скрипт стоит в <head> до приложения', beforeModule && html.indexOf('<script>') < html.indexOf('</head>'))

const vercel = JSON.parse(read('vercel.json'))
const csp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy')?.value ?? ''
const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src ')) ?? ''
check(`хэш скрипта в CSP script-src`, scriptSrc.split(/\s+/).includes(hashOf(script)), `нужен ${hashOf(script)}`)
check(`в script-src нет 'unsafe-inline'`, !scriptSrc.includes("'unsafe-inline'"), scriptSrc)

// ── 2. сборка ──────────────────────────────────────────────────────────────
const dist = new URL('dist/index.html', root)
if (existsSync(dist) && statSync(dist).mtimeMs >= statSync(new URL('index.html', root)).mtimeMs) {
  const built = inlineScripts(readFileSync(dist, 'utf8'))
  check('в dist/index.html скрипт тот же байт в байт', built.length === 1 && built[0] === script)
} else {
  console.log('· dist/index.html нет или он старше index.html — сборку не сверяю (CI собирает перед тестами)')
}

// ── 3. те же решения, что у theme.ts ───────────────────────────────────────
/** Прогнать скрипт в поддельном браузере: что он поставит на <html>. */
function boot(store, systemLight, blocked) {
  const attrs = {}
  let meta = null
  const sandbox = {
    localStorage: {
      getItem: (k) => {
        if (blocked) throw new Error('SecurityError')
        return store[k] ?? null
      },
    },
    matchMedia: (q) => ({ matches: q === '(prefers-color-scheme: light)' && systemLight }),
    document: {
      documentElement: { setAttribute: (k, v) => (attrs[k] = v) },
      querySelector: (s) => (s === 'meta[name="theme-color"]' ? { setAttribute: (k, v) => k === 'content' && (meta = v) } : null),
    },
  }
  vm.runInNewContext(script, sandbox)
  return { theme: attrs['data-theme'], palette: attrs['data-palette'] ?? 'twilight', meta }
}

// theme.ts читает localStorage через shared/lib/storage — подменяем глобальный
let store = {}
let blocked = false
globalThis.localStorage = {
  getItem: (k) => {
    if (blocked) throw new Error('SecurityError')
    return store[k] ?? null
  },
  setItem: () => {},
}
const { themeChoice, paletteChoice, resolveTheme } = await import('../src/shared/ui/theme.ts')

const V = variants()
const pageOf = (palette, theme) => Object.values(V).find((v) => v.palette === palette && v.theme === theme).t['--color-page'].toLowerCase()

let same = 0
let combos = 0
const wrong = []
for (const theme of [undefined, 'system', 'light', 'dark', 'Light', 'синяя']) {
  for (const palette of [undefined, 'twilight', 'sunset', 'Sunset', 'закат']) {
    for (const systemLight of [false, true]) {
      for (const isBlocked of [false, true]) {
        store = {}
        if (theme !== undefined) store['recall.theme'] = theme
        if (palette !== undefined) store['recall.palette'] = palette
        blocked = isBlocked
        const want = { theme: resolveTheme(themeChoice(), systemLight), palette: paletteChoice() }
        let got
        try {
          got = boot(store, systemLight, isBlocked)
        } catch (e) {
          got = { error: e.message }
        }
        combos++
        const ok = got.theme === want.theme && got.palette === want.palette && got.meta === pageOf(want.palette, want.theme)
        if (ok) same++
        else wrong.push(`${JSON.stringify({ theme, palette, systemLight, isBlocked })} → ${JSON.stringify(got)}, нужно ${JSON.stringify(want)}`)
      }
    }
  }
}
check(`скрипт = theme.ts и цвет строки = фон варианта: ${same} из ${combos} сочетаний`, same === combos, wrong.slice(0, 3).join('; '))
check('никто не выбирал — «Сумерки» и тема телефона', JSON.stringify(boot({}, true, false)) === JSON.stringify({ theme: 'light', palette: 'twilight', meta: pageOf('twilight', 'light') }))

// ── 4. цвета строки состояния в скрипте ────────────────────────────────────
for (const { palette, theme } of Object.values(V)) {
  const m = script.match(new RegExp(`${palette}:\\s*\\{[^}]*${theme}:\\s*'(#[0-9a-f]{6})'`, 'i'))
  check(`строка состояния ${palette} · ${theme} = --color-page`, m?.[1].toLowerCase() === pageOf(palette, theme), `${m?.[1]} / ${pageOf(palette, theme)}`)
}

console.log(`\nИтог: ${total - fails}/${total}`)
process.exitCode = fails ? 1 : 0
