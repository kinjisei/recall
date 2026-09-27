#!/usr/bin/env node
// Сторож токенов: цвет и размер — только через токены дизайн-системы
// (архитектура §5). Вне shared/ui (и старого src/index.css, где токены живут до
// переезда) запрещены:
//   palette — цвета палитры Tailwind: text-white, bg-zinc-800, border-red-500/40…
//   literal — цвет литералом: #38366b, rgb(…), hsl(…), oklch(…)
//   px      — произвольный размер в пикселях: w-[72px], text-[13px]
//   inline  — цвет в style={{…}} мимо токенов: color, background, fill…
// Почему это важно: светлая тема (журнал п.37) включается, только когда здесь
// ноль — иначе text-white и соседи исчезнут на светлом фоне.
//
// Запуск: node scripts/checks/tokens.mjs [--prune | --allow <путь> | --init]
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { isMain, rootPath, settle } from './_baseline.mjs'

const ROOT = rootPath('.').pathname.replace(/^\/([A-Za-z]:)/, '$1')
const rel = (p) => relative(ROOT, p).split(sep).join('/')

// Где токены определяются — там сырые значения законны
const EXEMPT = [/^src\/shared\/ui\//, /^src\/index\.css$/]

const COLORS =
  'slate|gray|zinc|neutral|stone|taupe|mauve|mist|olive|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const UTILS =
  'bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|outline|divide|placeholder|caret|accent|fill|stroke|decoration|shadow|inset-shadow|inset-ring|from|via|to'
const RULES = {
  palette: new RegExp(`(?<![\\w-])(?:${UTILS})-(?:white|black|(?:${COLORS})-\\d{2,3})(?:\\/\\d+)?(?![\\w-])`, 'g'),
  // перед rgba( может стоять «_» — так пишут пробел в значениях Tailwind:
  // shadow-[0_0_4px_rgba(…)]; граница слова \b его не пропустила бы
  literal: /#[0-9a-fA-F]{3,8}(?![\w-])|(?<![A-Za-z0-9-])(?:rgba?|hsla?|oklch|oklab)\(/g,
  px: /\[-?\d+(?:\.\d+)?px\]/g,
}
// свойство стиля, отвечающее за цвет; нарушение — если в значении нет ни одного
// токена var(--…) (литерал внутри значения отдельно посчитает literal)
const INLINE_PROP = /\b(?:color|background(?:Color|Image)?|border(?:[A-Z]\w*)?Color|fill|stroke|boxShadow|textShadow|outlineColor|caretColor)\s*:/g

/** Значение свойства: до запятой или скобки верхнего уровня. */
function valueAt(code, from) {
  let depth = 0
  let quote = null
  for (let i = from; i < code.length; i++) {
    const ch = code[i]
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === "'" || ch === '"' || ch === '`') quote = ch
    else if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth-- === 0) return code.slice(from, i)
    } else if (ch === ',' && depth === 0) return code.slice(from, i)
  }
  return code.slice(from)
}

function inlineColors(block) {
  let n = 0
  for (const m of block.matchAll(INLINE_PROP)) if (!/var\(--/.test(valueAt(block, m.index + m[0].length))) n++
  return n
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx?|css)$/.test(name)) out.push(full)
  }
  return out
}

/** Код без комментариев: имена классов в пояснениях нарушением не считаются. */
function codeLines(text) {
  let inBlock = false
  return text.split('\n').map((line) => {
    let out = line
    if (inBlock) {
      const end = out.indexOf('*/')
      if (end === -1) return ''
      out = out.slice(end + 2)
      inBlock = false
    }
    out = out.replace(/\/\*.*?\*\//g, '')
    const start = out.indexOf('/*')
    if (start !== -1) {
      out = out.slice(0, start)
      inBlock = true
    }
    // «//» внутри строки (https://…) комментарием не считаем
    return out.replace(/(^|[^:'"`\w])\/\/.*$/, '$1')
  })
}

/** Куски кода внутри style={{ … }} (могут занимать несколько строк). */
function styleBlocks(code) {
  const blocks = []
  let i = code.indexOf('style={{')
  while (i !== -1) {
    let depth = 0
    let j = i + 'style='.length
    for (; j < code.length; j++) {
      if (code[j] === '{') depth++
      else if (code[j] === '}' && --depth === 0) break
    }
    blocks.push(code.slice(i, j + 1))
    i = code.indexOf('style={{', j)
  }
  return blocks
}

/** Нарушения в тексте одного файла: { palette, literal, px, inline }. */
export function countIn(text) {
  // CRLF (так git выдаёт файлы на Windows) — к LF: иначе «//» в конце строки
  // не узнаётся как комментарий, и счёт расходится с CI
  const code = codeLines(text.replace(/\r\n?/g, '\n')).join('\n')
  const counts = {}
  for (const [kind, re] of Object.entries(RULES)) counts[kind] = (code.match(re) || []).length
  counts.inline = styleBlocks(code).reduce((s, b) => s + inlineColors(b), 0)
  return counts
}

export function scan() {
  const current = {}
  for (const full of walk(join(ROOT, 'src'))) {
    const path = rel(full)
    if (EXEMPT.some((re) => re.test(path))) continue
    for (const [kind, n] of Object.entries(countIn(readFileSync(full, 'utf8')))) if (n) current[`${path} ${kind}`] = n
  }
  return current
}

const HINT = {
  palette: 'цвет палитры Tailwind — нужен семантический токен (text-danger, bg-surface…)',
  literal: 'цвет литералом — нужен токен из shared/ui',
  px: 'размер в пикселях [Npx] — нужен токен или шаг шкалы Tailwind',
  inline: 'цвет в style={{…}} — нужен токен (var(--…)) или класс',
}

if (isMain(import.meta.url)) {
  const ok = settle({
    name: 'токены',
    file: 'scripts/checks/baseline/tokens.json',
    about:
      'Сторож токенов (scripts/checks/tokens.mjs): сколько сырых цветов (palette, literal, inline) и размеров [Npx] было в каждом файле, ' +
      'когда сторож появился. Уходят при переезде раздела на токены (PLAN.md Ф1.4, Ф3). Числа только уменьшаются.',
    current: scan(),
    describe: (key, now, was) => {
      const kind = key.split(' ').pop()
      return `${key}: было ${was}, стало ${now} — ${HINT[kind]}`
    },
  })
  process.exitCode = ok ? 0 : 1
}
