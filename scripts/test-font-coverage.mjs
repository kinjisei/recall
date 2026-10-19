/**
 * Казахские буквы рисуются нашим шрифтом (PLAN.md Ф2.16, Ф2.17-2): все 18
 * букв ӘәҒғҚқҢңӨөҰұҮүҺһІі есть в том файле шрифта, который браузер для них
 * скачает. В Onest этих букв не было (кроме і): имя «Нұрсұлтан» рисовалось
 * двумя шрифтами — эти буквы браузер брал из системного.
 *
 * Как: берём @font-face подключённого пакета (src/index.css →
 * @fontsource-variable/rubik), для каждой буквы — файл, чей unicode-range её
 * покрывает, распаковываем woff2 (Brotli) и ищем букву в таблице cmap. Заодно
 * — испанские ñ á é ¿ ¡ и русские ё Ё. Проверка самого разбора: латинская A
 * находится, а китайский 中 — нет (тест умеет сказать «нет»).
 * Чистый: без сети и браузера.
 *
 * Запуск: node scripts/test-font-coverage.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliDecompressSync } from 'node:zlib'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
let fails = 0
let total = 0
const check = (name, ok, extra = '') => {
  total++
  if (!ok) fails++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

// ── какой шрифт подключён ──────────────────────────────────────────────────
const indexCss = readFileSync(join(ROOT, 'src/index.css'), 'utf8')
const pkg = indexCss.match(/@import\s+'(@fontsource-variable\/[\w-]+)'/)?.[1]
check('src/index.css подключает шрифт из @fontsource-variable', !!pkg, pkg)
if (!pkg) process.exit(1)
const faceCssPath = join(ROOT, 'node_modules', pkg, 'index.css')
const faceCss = readFileSync(faceCssPath, 'utf8')
const tokens = readFileSync(join(ROOT, 'src/shared/ui/tokens.css'), 'utf8')
const family = faceCss.match(/font-family:\s*'([^']+)'/)?.[1]
const first = tokens.match(/--font-sans:\s*'([^']+)'/)?.[1]
check('первый шрифт --font-sans — тот, что подключён', !!family && first === family, `${first} / ${family}`)

/** @font-face пакета: файл и диапазоны. */
const faces = [...faceCss.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)].map((m) => {
  const body = m[1]
  const file = body.match(/url\(([^)]+)\)/)[1].replace(/['"]/g, '')
  const ranges = (body.match(/unicode-range:\s*([^;]+);/)?.[1] ?? 'U+0-10FFFF').split(',').map((r) => {
    const [a, b] = r.trim().replace(/^U\+/i, '').split('-')
    return [parseInt(a, 16), parseInt(b ?? a, 16)]
  })
  const italic = /font-style:\s*italic/.test(body)
  return { file: join(dirname(faceCssPath), file), ranges, italic }
})
// Диапазоны пересекаются (Ұ ұ есть и в cyrillic, и в cyrillic-ext). Браузер
// при пересечении проверяет правила с конца — последнее объявленное первым
// (CSS Fonts 4, §4.5); так и ищем.
const faceFor = (cp) => faces.findLast((f) => !f.italic && f.ranges.some(([a, b]) => cp >= a && cp <= b))

// ── woff2 → cmap ───────────────────────────────────────────────────────────
const KNOWN = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill']

/** Таблица cmap из woff2 (спецификация W3C WOFF 2.0, §4–5). */
function cmapOf(path) {
  const buf = readFileSync(path)
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error(`${path}: не woff2`)
  const numTables = buf.readUInt16BE(12)
  const compressed = buf.readUInt32BE(20)
  let pos = 48
  const base128 = () => {
    let v = 0
    for (let i = 0; i < 5; i++) {
      const b = buf[pos++]
      v = v * 128 + (b & 0x7f)
      if (!(b & 0x80)) return v
    }
    throw new Error('UIntBase128 длиннее 5 байт')
  }
  const tables = []
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos++]
    let tag = KNOWN[flags & 0x3f]
    if ((flags & 0x3f) === 63) {
      tag = buf.toString('latin1', pos, pos + 4)
      pos += 4
    }
    const version = flags >> 6
    const orig = base128()
    // glyf и loca преобразованы при версии 0, остальные — при версии ≠ 0
    const transformed = tag === 'glyf' || tag === 'loca' ? version !== 3 : version !== 0
    const length = transformed ? base128() : orig
    tables.push({ tag, length })
  }
  const data = brotliDecompressSync(buf.subarray(pos, pos + compressed))
  let offset = 0
  for (const t of tables) {
    if (t.tag === 'cmap') return data.subarray(offset, offset + t.length)
    offset += t.length
  }
  throw new Error(`${path}: нет таблицы cmap`)
}

/** Есть ли у знака глиф (≠ 0) по подтаблице Unicode (формат 12 или 4). */
function hasGlyph(cmap, cp) {
  if (cmap.readUInt16BE(0) !== 0) throw new Error('cmap: неизвестная версия')
  const n = cmap.readUInt16BE(2)
  const subs = []
  for (let i = 0; i < n; i++) {
    const platform = cmap.readUInt16BE(4 + i * 8)
    const encoding = cmap.readUInt16BE(6 + i * 8)
    const off = cmap.readUInt32BE(8 + i * 8)
    if (platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10))) subs.push(off)
  }
  const twelve = subs.find((o) => cmap.readUInt16BE(o) === 12)
  if (twelve !== undefined) {
    const groups = cmap.readUInt32BE(twelve + 12)
    for (let g = 0; g < groups; g++) {
      const at = twelve + 16 + g * 12
      const start = cmap.readUInt32BE(at)
      const end = cmap.readUInt32BE(at + 4)
      if (cp >= start && cp <= end) return cmap.readUInt32BE(at + 8) + (cp - start) !== 0
    }
    return false
  }
  const four = subs.find((o) => cmap.readUInt16BE(o) === 4)
  if (four === undefined) throw new Error('cmap: нет подтаблицы Unicode формата 4 или 12')
  if (cp > 0xffff) return false
  const segs = cmap.readUInt16BE(four + 6) / 2
  const ends = four + 14
  const starts = ends + segs * 2 + 2
  const deltas = starts + segs * 2
  const ranges = deltas + segs * 2
  for (let s = 0; s < segs; s++) {
    const end = cmap.readUInt16BE(ends + s * 2)
    if (cp > end) continue
    const start = cmap.readUInt16BE(starts + s * 2)
    if (cp < start) return false
    const delta = cmap.readUInt16BE(deltas + s * 2)
    const range = cmap.readUInt16BE(ranges + s * 2)
    if (range === 0) return ((cp + delta) & 0xffff) !== 0
    const glyph = cmap.readUInt16BE(ranges + s * 2 + range + (cp - start) * 2)
    return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0
  }
  return false
}

const cache = new Map()
const covered = (ch) => {
  const cp = ch.codePointAt(0)
  const face = faceFor(cp)
  if (!face) return { ok: false, why: 'ни один @font-face не берёт этот знак' }
  if (!cache.has(face.file)) cache.set(face.file, cmapOf(face.file))
  const file = face.file.split(/[\\/]/).pop()
  return { ok: hasGlyph(cache.get(face.file), cp), why: file }
}

// ── проверка самого разбора ────────────────────────────────────────────────
check('разбор: латинская A есть', covered('A').ok)
const cyr = faces.find((f) => f.ranges.some(([a, b]) => 0x0410 >= a && 0x0410 <= b))
check('разбор: китайского 中 в файле кириллицы нет', !!cyr && !hasGlyph(cmapOf(cyr.file), 0x4e2d))

// ── буквы ─────────────────────────────────────────────────────────────────
for (const [label, letters] of [
  ['казахская', 'ӘәҒғҚқҢңӨөҰұҮүҺһІі'],
  ['испанская', 'ñÑáéíóúü¿¡'],
  ['русская', 'ёЁйЙ'],
]) {
  for (const ch of letters) {
    const r = covered(ch)
    check(`${label} «${ch}» U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`, r.ok, r.why)
  }
}

console.log(`\nИтог: ${total - fails}/${total}`)
process.exitCode = fails ? 1 : 0
